import { type FileEntry, getPlatform } from "@cortex/platform"
import {
	getBaseName,
	getExtension,
	getParentPath,
	getRelativePath,
	isMarkdownPath,
	joinPath,
	mapWithConcurrency,
	normalizePath,
	splitExtension,
	toVaultRelativePath,
} from "@cortex/platform/utils"
import { type ObsidianConfig, readObsidianConfig } from "./config"
import { addFinding, type ObsidianFinding, type ObsidianFindings } from "./findings"
import { convertObsidianMarkdown, encodeMarkdownLinkPath } from "./markdown"
import { getObsidianTemplatePaths, mapObsidianSettings, type VaultSettingsImport } from "./settings"

export interface ObsidianProgress {
	completed: number
	total: number
}

interface ObsidianRunOptions {
	onProgress?: (progress: ObsidianProgress) => void
	signal?: AbortSignal
}

export interface ObsidianImportOptions extends ObsidianRunOptions {
	sourcePath: string
	vaultPath: string
	destinationPath: string
}

export interface ObsidianAnalyzeOptions extends ObsidianRunOptions {
	vaultPath: string
	files: readonly FileEntry[]
}

export interface ObsidianFailure {
	path: string
	error: string
}

export interface ObsidianImportResult {
	notes: number
	attachments: number
	convertedEmbeds: number
	renamed: number
	failed: ObsidianFailure[]
	findings: ObsidianFinding[]
	settings: VaultSettingsImport
	cancelled: boolean
	destinationPath: string
}

interface PlannedFile {
	sourcePath: string
	relativePath: string
	targetPath: string
}

interface AttachmentIndex {
	byPath: Map<string, string>
	byName: Map<string, string[]>
}

const READ_BATCH_SIZE = 200
const WRITE_CONCURRENCY = 16
const EMPTY_CONFIG: ObsidianConfig = {
	app: {},
	dailyNotes: null,
	templates: null,
	bookmarks: null,
	types: null,
	enabledCorePlugins: new Set(),
	communityPlugins: [],
}

function isExcalidrawPath(path: string): boolean {
	const lower = path.toLocaleLowerCase()
	return lower.endsWith(".excalidraw.md") || lower.endsWith(".excalidraw")
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function reserveTargetPath(path: string, reserved: Set<string>): string {
	const directory = getParentPath(path)
	const { baseName, extension } = splitExtension(getBaseName(path))
	let candidate = path
	let suffix = 2
	while (reserved.has(candidate.toLocaleLowerCase())) {
		candidate = joinPath(directory, `${baseName} ${suffix}${extension}`)
		suffix += 1
	}
	reserved.add(candidate.toLocaleLowerCase())
	return candidate
}

function buildAttachmentIndex(relativePaths: Iterable<string>): AttachmentIndex {
	const byPath = new Map<string, string>()
	const byName = new Map<string, string[]>()
	for (const path of relativePaths) {
		if (isMarkdownPath(path)) continue
		const lower = path.toLocaleLowerCase()
		byPath.set(lower, path)
		const name = getBaseName(lower)
		byName.set(name, [...(byName.get(name) ?? []), path])
	}
	for (const candidates of byName.values()) {
		candidates.sort((a, b) => a.length - b.length || a.localeCompare(b))
	}
	return { byPath, byName }
}

function resolveAttachment(
	index: AttachmentIndex,
	target: string,
	noteRelativePath: string,
): string | null {
	const normalized = normalizePath(target)
		.replace(/^\.?\//u, "")
		.toLocaleLowerCase()
	const noteDirectory = getParentPath(noteRelativePath).toLocaleLowerCase()
	const direct =
		index.byPath.get(normalized) ??
		index.byPath.get(noteDirectory ? `${noteDirectory}/${normalized}` : normalized)
	if (direct) return direct
	if (normalized.includes("/")) {
		for (const [lower, path] of index.byPath) {
			if (lower.endsWith(`/${normalized}`)) return path
		}
	}
	const candidates = index.byName.get(getBaseName(normalized)) ?? []
	return (
		candidates.find((path) => getParentPath(path).toLocaleLowerCase() === noteDirectory) ??
		candidates[0] ??
		null
	)
}

async function copyFileExclusive(sourcePath: string, targetPath: string): Promise<void> {
	const fs = getPlatform().fs
	if (fs.copyFile) {
		await fs.copyFile(sourcePath, targetPath)
		return
	}
	if (!fs.readBinaryFile) throw new Error("This platform cannot copy attachments")
	await fs.writeBinaryFile(targetPath, await fs.readBinaryFile(sourcePath))
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size))
	}
	return chunks
}

async function readTemplateBodies(
	config: ObsidianConfig,
	rootPath: string,
	relativePaths: readonly string[],
): Promise<Map<string, string>> {
	const templatePaths = getObsidianTemplatePaths(config, relativePaths)
	const reads = await getPlatform().fs.readTextFiles(
		templatePaths.map((path) => joinPath(rootPath, path)),
	)
	const bodies = new Map<string, string>()
	templatePaths.forEach((path, index) => {
		const read = reads[index]
		if (read) bodies.set(path, read.content)
	})
	return bodies
}

function sortFindings(findings: ObsidianFindings): ObsidianFinding[] {
	return [...findings.values()].sort((a, b) => b.count - a.count)
}

export async function importObsidianVault(
	options: ObsidianImportOptions,
): Promise<ObsidianImportResult> {
	const platform = getPlatform()
	const destinationPath = normalizePath(options.destinationPath)
	const [config, sourceEntries, existingEntries] = await Promise.all([
		readObsidianConfig(options.sourcePath),
		platform.vault.scanVault(options.sourcePath),
		platform.vault.scanVault(destinationPath).catch(() => [] as FileEntry[]),
	])
	const reserved = new Set(existingEntries.map((entry) => entry.path.toLocaleLowerCase()))
	const findings: ObsidianFindings = new Map()
	let renamed = 0
	const plannedFiles = sourceEntries.flatMap((entry): PlannedFile[] => {
		if (entry.isDir) return []
		const relativePath = toVaultRelativePath(entry.path, options.sourcePath) ?? entry.name
		const preferredPath = joinPath(destinationPath, relativePath)
		const targetPath = reserveTargetPath(preferredPath, reserved)
		if (targetPath !== preferredPath) renamed++
		return [{ sourcePath: entry.path, relativePath, targetPath }]
	})
	const targetByRelativePath = new Map(
		plannedFiles.map((file) => [file.relativePath.toLocaleLowerCase(), file.targetPath]),
	)
	const directories = new Map(
		sourceEntries.flatMap((entry): [string, string][] => {
			if (!entry.isDir) return []
			const relativePath = toVaultRelativePath(entry.path, options.sourcePath) ?? entry.name
			return [[relativePath.toLocaleLowerCase(), relativePath]]
		}),
	)
	const attachmentIndex = buildAttachmentIndex(plannedFiles.map((file) => file.relativePath))
	const notes = plannedFiles.filter((file) => isMarkdownPath(file.sourcePath))
	const attachments = plannedFiles.filter((file) => !isMarkdownPath(file.sourcePath))
	const failed: ObsidianFailure[] = []
	const total = plannedFiles.length
	let completed = 0
	let convertedEmbeds = 0
	let importedNotes = 0
	let importedAttachments = 0
	let cancelled = false

	await platform.fs.createDir(destinationPath)
	options.onProgress?.({ completed, total })

	for (const batch of chunk(notes, READ_BATCH_SIZE)) {
		if (options.signal?.aborted) {
			cancelled = true
			break
		}
		const reads = await platform.fs.readTextFiles(batch.map((file) => file.sourcePath))
		const batchReads = batch.map((file, index) => ({ file, read: reads[index] }))
		await mapWithConcurrency(batchReads, WRITE_CONCURRENCY, async ({ file, read }) => {
			try {
				if (!read) throw new Error("The note could not be read")
				if (isExcalidrawPath(file.relativePath)) {
					addFinding(findings, "excalidraw", file.relativePath)
					await copyFileExclusive(file.sourcePath, file.targetPath)
				} else {
					const noteDirectory = getParentPath(file.targetPath)
					const result = convertObsidianMarkdown(read.content, findings, (target) => {
						const attachment = resolveAttachment(attachmentIndex, target, file.relativePath)
						const attachmentTarget = attachment
							? targetByRelativePath.get(attachment.toLocaleLowerCase())
							: undefined
						return attachmentTarget
							? encodeMarkdownLinkPath(getRelativePath(noteDirectory, attachmentTarget))
							: null
					})
					convertedEmbeds += result.convertedEmbeds
					if (result.convertedEmbeds > 0) {
						await platform.fs.writeFile(file.targetPath, result.content)
					} else {
						await copyFileExclusive(file.sourcePath, file.targetPath)
					}
				}
				importedNotes++
			} catch (error) {
				failed.push({ path: file.relativePath, error: toErrorMessage(error) })
			}
		})
		completed += batch.length
		options.onProgress?.({ completed, total })
	}

	for (const batch of chunk(attachments, READ_BATCH_SIZE)) {
		if (cancelled || options.signal?.aborted) {
			cancelled = true
			break
		}
		await mapWithConcurrency(batch, WRITE_CONCURRENCY, async (file) => {
			try {
				if (getExtension(file.relativePath) === "canvas") {
					addFinding(findings, "canvas", file.relativePath)
				} else if (isExcalidrawPath(file.relativePath)) {
					addFinding(findings, "excalidraw", file.relativePath)
				}
				await copyFileExclusive(file.sourcePath, file.targetPath)
				importedAttachments++
			} catch (error) {
				failed.push({ path: file.relativePath, error: toErrorMessage(error) })
			}
		})
		completed += batch.length
		options.onProgress?.({ completed, total })
	}

	if (!cancelled) {
		const filledDirectories = new Set<string>()
		for (const file of plannedFiles) {
			let parent = getParentPath(file.relativePath.toLocaleLowerCase())
			while (parent && !filledDirectories.has(parent)) {
				filledDirectories.add(parent)
				parent = getParentPath(parent)
			}
		}
		const emptyDirectories = [...directories].flatMap(([lower, directory]) =>
			filledDirectories.has(lower) ? [] : [directory],
		)
		await mapWithConcurrency(emptyDirectories, WRITE_CONCURRENCY, (directory) =>
			platform.fs.createDir(joinPath(destinationPath, directory)),
		)
	}

	const resolvedConfig = config ?? EMPTY_CONFIG
	const settings = cancelled
		? { templates: [], bookmarks: [], propertyTypes: [] }
		: mapObsidianSettings(
				resolvedConfig,
				{
					destinationRelativePath: toVaultRelativePath(destinationPath, options.vaultPath) ?? "",
					resolveTargetPath: (path) =>
						targetByRelativePath.get(path.toLocaleLowerCase()) ??
						(directories.has(path.toLocaleLowerCase()) ? joinPath(destinationPath, path) : null),
					templateBodies: await readTemplateBodies(
						resolvedConfig,
						options.sourcePath,
						plannedFiles.map((file) => file.relativePath),
					),
				},
				findings,
			)

	return {
		notes: importedNotes,
		attachments: importedAttachments,
		convertedEmbeds,
		renamed,
		failed,
		findings: sortFindings(findings),
		settings,
		cancelled,
		destinationPath,
	}
}

export async function analyzeObsidianVault(
	options: ObsidianAnalyzeOptions,
): Promise<ObsidianImportResult> {
	const platform = getPlatform()
	const config = (await readObsidianConfig(options.vaultPath)) ?? EMPTY_CONFIG
	const findings: ObsidianFindings = new Map()
	const files = options.files.filter((file) => !file.isDir)
	const relativePaths = files.map(
		(file) => toVaultRelativePath(file.path, options.vaultPath) ?? file.name,
	)
	const markdownFiles = files.filter((file) => isMarkdownPath(file.path))
	const notes = markdownFiles.filter((file) => !isExcalidrawPath(file.path))
	const failed: ObsidianFailure[] = []
	let completed = 0
	let cancelled = false
	options.onProgress?.({ completed, total: notes.length })

	for (const batch of chunk(notes, READ_BATCH_SIZE)) {
		if (options.signal?.aborted) {
			cancelled = true
			break
		}
		const reads = await platform.fs.readTextFiles(batch.map((file) => file.path))
		batch.forEach((file, index) => {
			const read = reads[index]
			if (read) convertObsidianMarkdown(read.content, findings)
			else failed.push({ path: file.path, error: "The note could not be read" })
		})
		completed += batch.length
		options.onProgress?.({ completed, total: notes.length })
	}

	relativePaths.forEach((path) => {
		if (getExtension(path) === "canvas") addFinding(findings, "canvas", path)
		else if (isExcalidrawPath(path)) addFinding(findings, "excalidraw", path)
	})
	const filePaths = new Set(relativePaths.map((path) => path.toLocaleLowerCase()))
	const directories = new Set(
		options.files.flatMap((file) =>
			file.isDir
				? [(toVaultRelativePath(file.path, options.vaultPath) ?? file.name).toLocaleLowerCase()]
				: [],
		),
	)
	const settings = mapObsidianSettings(
		config,
		{
			destinationRelativePath: "",
			resolveTargetPath: (path) => {
				const lower = path.toLocaleLowerCase()
				return filePaths.has(lower) || directories.has(lower)
					? joinPath(options.vaultPath, path)
					: null
			},
			templateBodies: await readTemplateBodies(config, options.vaultPath, relativePaths),
		},
		findings,
	)

	return {
		notes: cancelled ? completed : markdownFiles.length,
		attachments: files.length - markdownFiles.length,
		convertedEmbeds: 0,
		renamed: 0,
		failed,
		findings: sortFindings(findings),
		settings,
		cancelled,
		destinationPath: options.vaultPath,
	}
}
