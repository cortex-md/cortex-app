import {
	applyVaultSettingsImport,
	convertFolderToDatabase,
	openVaultSession,
	registerVaultFolder,
	useVaultStore,
	type VaultSettingsImportResult,
} from "@cortex/core"
import {
	analyzeObsidianVault,
	csvRecordsToMarkdownTable,
	getImporterDialogFilters,
	htmlToMarkdown,
	importFiles,
	importObsidianVault,
	isObsidianVault,
	OBSIDIAN_CONFIG_DIR,
	type ObsidianImportResult,
	parseCsvRecords,
	sanitizeFileStem,
	type VaultSettingsImport,
} from "@cortex/import-export"
import { type FileEntry, getPlatform } from "@cortex/platform"
import { getBaseName, getParentPath, joinPath } from "@cortex/platform/utils"
import { Platform } from "react-native"

import {
	FIXTURE_OBSIDIAN_STEP,
	FIXTURE_OBSIDIAN_TICK_MS,
	FIXTURE_PDF_PAGES,
	fixtureCsvDatabasePreview,
	fixtureCsvTablePreview,
	fixtureImportFiles,
	fixtureObsidianFolder,
	fixtureObsidianOutcome,
	isStubPath,
} from "@/features/importExport/importFixtures"
import {
	destinationPath,
	extensionLabel,
	FINDING_LABELS,
	fileKindFromName,
	fileStem,
} from "@/features/importExport/importPlan"
import type {
	ImportDestination,
	ImportPreview,
	ImportRunResult,
	ImportSourceFile,
	InspectedFolder,
	ObsidianOutcome,
	ObsidianRunOptions,
	PlannedImportFile,
} from "@/features/importExport/importTypes"

const MAX_WALK_ENTRIES = 20000
const PREVIEW_ROWS = 8
const REPORT_NOTE_NAME = "Imported from Obsidian.md"

function requireVault() {
	const vault = useVaultStore.getState().vault
	if (!vault) throw new Error("Open a vault before importing.")
	return vault
}

async function readSource(file: ImportSourceFile): Promise<string> {
	if (file.stubContent !== undefined) return file.stubContent
	return getPlatform().fs.readFile(file.path)
}

async function toSourceFile(path: string): Promise<ImportSourceFile> {
	const name = getBaseName(path)
	const kind = fileKindFromName(name)
	let csvRowCount = 0
	if (kind === "csv") {
		try {
			csvRowCount = Math.max(parseCsvRecords(await getPlatform().fs.readFile(path)).length - 1, 0)
		} catch {
			csvRowCount = 0
		}
	}
	return {
		csvRowCount,
		extensionLabel: extensionLabel(name),
		id: path,
		kind,
		name,
		path,
		stub: false,
	}
}

export async function pickImportFiles(): Promise<ImportSourceFile[]> {
	// stub: native multi-file picking rejects on mobile; fixture files stand in until it exists
	try {
		const paths = await getPlatform().dialog.pickFiles({
			filters: getImporterDialogFilters(),
			title: "Import files",
		})
		return Promise.all(paths.map(toSourceFile))
	} catch {
		return fixtureImportFiles
	}
}

async function walkFolder(root: string): Promise<FileEntry[]> {
	const fs = getPlatform().fs
	const entries: FileEntry[] = []
	const queue = [root]
	while (queue.length > 0 && entries.length < MAX_WALK_ENTRIES) {
		const directory = queue.shift() as string
		let children: FileEntry[] = []
		try {
			children = await fs.listDir(directory)
		} catch {
			continue
		}
		for (const child of children) {
			if (child.name.startsWith(".")) continue
			if (child.isDir) queue.push(child.path)
			else entries.push(child)
		}
	}
	return entries
}

async function readJson(path: string): Promise<unknown> {
	try {
		return JSON.parse(await getPlatform().fs.readFile(path))
	} catch {
		return null
	}
}

function countBookmarkItems(value: unknown): number {
	if (!value || typeof value !== "object") return 0
	const items = (value as { items?: unknown }).items
	if (!Array.isArray(items)) return 0
	return items.reduce<number>((total, item) => {
		const record = item as { type?: string; items?: unknown }
		if (record.type === "group") return total + countBookmarkItems(record)
		return total + 1
	}, 0)
}

async function countObsidianExtras(
	path: string,
): Promise<{ templates: number; bookmarks: number }> {
	const config = joinPath(path, OBSIDIAN_CONFIG_DIR)
	const [templates, bookmarks] = await Promise.all([
		readJson(joinPath(config, "templates.json")),
		readJson(joinPath(config, "bookmarks.json")),
	])
	const templateFolder = (templates as { folder?: string } | null)?.folder
	let templateCount = 0
	if (templateFolder) {
		try {
			const entries = await getPlatform().fs.listDir(joinPath(path, templateFolder))
			templateCount = entries.filter((entry) => !entry.isDir && entry.name.endsWith(".md")).length
		} catch {
			templateCount = 0
		}
	}
	return { bookmarks: countBookmarkItems(bookmarks), templates: templateCount }
}

function locationLabelFor(path: string): string {
	const parent = getBaseName(getParentPath(path)) || "Files"
	return Platform.OS === "ios" ? `On My iPhone › ${parent}` : `Documents › ${parent}`
}

export async function inspectFolder(path: string): Promise<InspectedFolder> {
	const [entries, isObsidian, extras] = await Promise.all([
		walkFolder(path),
		isObsidianVault(path),
		countObsidianExtras(path),
	])
	const notes = entries.filter((entry) => entry.name.toLowerCase().endsWith(".md")).length
	const importable = await Promise.all(
		entries
			.filter((entry) => fileKindFromName(entry.name) !== "unsupported")
			.map((entry) => toSourceFile(entry.path)),
	)
	return {
		attachments: entries.length - notes,
		bookmarks: extras.bookmarks,
		importableFiles: importable,
		isObsidian,
		locationLabel: locationLabelFor(path),
		name: getBaseName(path),
		notes,
		path,
		stub: false,
		templates: extras.templates,
		totalFiles: entries.length,
	}
}

export async function pickImportFolder(): Promise<InspectedFolder | null> {
	// stub: when the native folder picker is unavailable the fixture Obsidian vault stands in
	try {
		const path = await getPlatform().dialog.pickFolder({ title: "Choose a folder" })
		if (!path) return null
		return await inspectFolder(path)
	} catch {
		return fixtureObsidianFolder
	}
}

function formatCell(value: string): string {
	const numeric = Number(value.replace(/,/gu, ""))
	if (value.trim() === "" || Number.isNaN(numeric) || !/^-?\d+(\.\d+)?$/u.test(value.trim()))
		return value
	return numeric.toLocaleString("en-US")
}

export async function previewImportFile(
	file: ImportSourceFile,
	csvMode: "table" | "database",
): Promise<ImportPreview> {
	const title = fileStem(file.name)
	if (file.kind === "unsupported") {
		return {
			kind: "unsupported",
			message: `${file.extensionLabel} isn’t supported. Export it as PDF and add it again.`,
			title: file.name,
		}
	}
	if (file.kind === "csv") {
		if (file.stub) return csvMode === "table" ? fixtureCsvTablePreview : fixtureCsvDatabasePreview
		const records = parseCsvRecords(await readSource(file))
		const [header = [], ...rows] = records
		if (csvMode === "table") {
			return {
				header,
				kind: "csv-table",
				rows: rows.slice(0, PREVIEW_ROWS).map((row) => row.map(formatCell)),
				title,
			}
		}
		const first = rows[0] ?? []
		return {
			kind: "csv-database",
			properties: header.map((key, index) => [key, formatCell(first[index] ?? "")]),
			title: first[0] || title,
			total: rows.length,
		}
	}
	if (file.kind === "html") {
		return { kind: "html", markdown: htmlToMarkdown(await readSource(file)), title }
	}
	// stub: PDF text extraction rejects on mobile, so the fixture pages stand in
	try {
		const documentImport = getPlatform().documentImport
		if (!documentImport) throw new Error("PDF text extraction is unavailable.")
		const extraction = await documentImport.extractPdfText({ path: file.path })
		return { kind: "pdf", pages: extraction.pages.map((page) => page.text), title }
	} catch {
		return { kind: "pdf", pages: FIXTURE_PDF_PAGES, title }
	}
}

async function ensureFolder(path: string): Promise<void> {
	try {
		await getPlatform().fs.createDir(path)
	} catch {
		return
	}
}

function frontmatterNote(header: string[], row: string[]): string {
	const lines = header
		.slice(1)
		.map((key, index) => `${key}: ${JSON.stringify(row[index + 1] ?? "")}`)
	return lines.length > 0 ? `---\n${lines.join("\n")}\n---\n` : ""
}

async function importCsvDatabase(
	plan: PlannedImportFile,
	destination: string,
): Promise<{ path: string; notes: number }> {
	const store = useVaultStore.getState()
	const [header = [], ...rows] = parseCsvRecords(await readSource(plan.file))
	const folderPath = await store.createFolder(destination, plan.targetName)
	const taken = new Set<string>()
	let notes = 0
	for (const [index, row] of rows.entries()) {
		const stem = sanitizeFileStem(row[0] || `Row ${index + 1}`) || `Row ${index + 1}`
		let name = `${stem}.md`
		let suffix = 2
		while (taken.has(name.toLowerCase())) {
			name = `${stem} ${suffix}.md`
			suffix += 1
		}
		taken.add(name.toLowerCase())
		await useVaultStore
			.getState()
			.createFileWithContent(
				folderPath,
				name,
				`${frontmatterNote(header, row)}# ${row[0] || stem}\n`,
			)
		notes += 1
	}
	try {
		await convertFolderToDatabase(folderPath)
	} catch {
		return { notes, path: folderPath }
	}
	return { notes, path: folderPath }
}

async function stubMarkdown(file: ImportSourceFile): Promise<string> {
	// stub: fixture files carry their content inline instead of living on disk
	const title = fileStem(file.name)
	if (file.kind === "csv")
		return `# ${title}\n\n${csvRecordsToMarkdownTable(parseCsvRecords(await readSource(file)))}\n`
	if (file.kind === "html") return htmlToMarkdown(await readSource(file))
	return `# ${title}\n\n${FIXTURE_PDF_PAGES.join("\n\n")}\n`
}

export async function runFileImport(
	plans: readonly PlannedImportFile[],
	destination: ImportDestination,
	csvMode: "table" | "database",
): Promise<ImportRunResult> {
	const vault = requireVault()
	const folder = destinationPath(vault.path, destination)
	await ensureFolder(folder)
	const rows: ImportRunResult["rows"] = []
	const createdPaths: string[] = []
	let notes = 0
	for (const plan of plans) {
		if (plan.status === "skipped") {
			rows.push({ label: `${plan.file.name} — skipped`, ok: false })
			continue
		}
		try {
			if (plan.file.kind === "csv" && csvMode === "database") {
				const created = await importCsvDatabase(plan, folder)
				createdPaths.push(created.path)
				notes += created.notes
				rows.push({ label: `${plan.targetName}/`, ok: true })
				continue
			}
			if (plan.file.stub) {
				const path = await useVaultStore
					.getState()
					.createFileWithContent(folder, plan.targetName, await stubMarkdown(plan.file))
				createdPaths.push(path)
				notes += 1
				rows.push({ label: getBaseName(path), ok: true })
				continue
			}
			const result = await importFiles({
				destinationPath: folder,
				existingFiles: useVaultStore.getState().files,
				sourcePaths: [plan.file.path],
				vaultPath: vault.path,
			})
			const first = result.results[0]
			if (first?.status === "imported" && first.targetPath) {
				createdPaths.push(first.targetPath)
				notes += 1
				rows.push({ label: getBaseName(first.targetPath), ok: true })
			} else {
				rows.push({ label: `${plan.file.name} — skipped`, ok: false })
			}
		} catch {
			rows.push({ label: `${plan.file.name} — skipped`, ok: false })
		}
	}
	await useVaultStore.getState().refreshFiles()
	return { createdPaths, notes, rows }
}

export async function undoFileImport(result: ImportRunResult): Promise<void> {
	const store = useVaultStore.getState()
	await Promise.allSettled(result.createdPaths.map((path) => store.deleteFile(path)))
	await useVaultStore.getState().refreshFiles()
}

function settingsSummary(settings: VaultSettingsImport, applied: VaultSettingsImportResult | null) {
	const attachments = settings.attachments
	const attachmentLocation = !attachments
		? "Unchanged"
		: attachments.location === "custom"
			? `${attachments.customPath.replace(/\/+$/u, "")}/`
			: attachments.location === "same"
				? "Next to each note"
				: "Vault root"
	return {
		attachmentLocation,
		bookmarks: applied?.bookmarks ?? settings.bookmarks.length,
		dailyNotes: settings.dailyNotes
			? `${settings.dailyNotes.folder.replace(/\/+$/u, "") || "Daily"}/`
			: "Unchanged",
		propertyTypes: applied?.propertyTypes ?? settings.propertyTypes.length,
		templates: applied?.templates ?? settings.templates.length,
	}
}

function toOutcome(
	result: ObsidianImportResult,
	applied: VaultSettingsImportResult | null,
	options: ObsidianRunOptions,
	destinationLabel: string,
): ObsidianOutcome {
	return {
		attachments: result.attachments,
		cancelled: result.cancelled,
		convertedEmbeds: result.convertedEmbeds,
		destinationLabel,
		findings: result.findings
			.filter((finding) => finding.count > 0)
			.map((finding) => ({
				count: finding.count,
				examples: finding.examples.join(", "),
				label: FINDING_LABELS[finding.kind],
			})),
		mode: options.mode,
		notes: result.notes,
		renamed: result.renamed,
		settings: settingsSummary(result.settings, applied),
		settingsApplied: applied !== null && (options.mode === "open" || options.applySettings),
	}
}

async function writeReportNote(
	folder: string,
	outcome: ObsidianOutcome,
	result: ObsidianImportResult,
) {
	const lines = [
		"# Imported from Obsidian",
		"",
		`Notes: ${outcome.notes}`,
		`Attachments: ${outcome.attachments}`,
		`Image embeds converted: ${outcome.convertedEmbeds}`,
		`Renamed to avoid conflicts: ${outcome.renamed}`,
		"",
		"## Not supported in Cortex",
		...outcome.findings.map(
			(finding) => `- ${finding.label} (${finding.count}): ${finding.examples}`,
		),
		...(result.failed.length > 0
			? ["", "## Failed", ...result.failed.map((item) => `- ${item.path}: ${item.error}`)]
			: []),
		"",
	]
	try {
		await useVaultStore.getState().createFileWithContent(folder, REPORT_NOTE_NAME, lines.join("\n"))
	} catch {
		return
	}
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms)
		signal.addEventListener("abort", () => {
			clearTimeout(timer)
			resolve()
		})
	})
}

async function runFixtureObsidian(
	options: ObsidianRunOptions,
	destinationLabel: string,
): Promise<ObsidianOutcome> {
	// stub: the fixture vault simulates copy progress instead of touching the filesystem
	const total = options.folder.totalFiles
	let done = 0
	if (options.mode === "copy") {
		while (done < total && !options.signal.aborted) {
			await wait(FIXTURE_OBSIDIAN_TICK_MS, options.signal)
			if (options.signal.aborted) break
			done = Math.min(total, done + FIXTURE_OBSIDIAN_STEP)
			options.onProgress({ completed: done, total })
		}
	}
	const cancelled = options.mode === "copy" && done < total
	return {
		...fixtureObsidianOutcome,
		attachments: cancelled
			? Math.max(0, done - fixtureObsidianOutcome.notes)
			: fixtureObsidianOutcome.attachments,
		cancelled,
		destinationLabel,
		mode: options.mode,
		notes: cancelled ? Math.min(done, fixtureObsidianOutcome.notes) : fixtureObsidianOutcome.notes,
		settingsApplied: options.mode === "open" || options.applySettings,
	}
}

export async function runObsidianImport(options: ObsidianRunOptions): Promise<ObsidianOutcome> {
	const folderName = options.destinationFolder.trim()
	const destinationLabel = folderName || "vault root"
	if (isStubPath(options.folder.path)) return runFixtureObsidian(options, destinationLabel)
	if (options.mode === "open") {
		await registerVaultFolder(options.folder.path, { name: options.folder.name })
		await openVaultSession(options.folder.path)
		const opened = requireVault()
		const result = await analyzeObsidianVault({
			files: useVaultStore.getState().files,
			onProgress: options.onProgress,
			signal: options.signal,
			vaultPath: opened.path,
		})
		const applied = result.cancelled
			? null
			: await applyVaultSettingsImport(opened, result.settings, { applyVaultSettings: true })
		return toOutcome(result, applied, options, destinationLabel)
	}
	const vault = requireVault()
	const destination = folderName ? joinPath(vault.path, folderName) : vault.path
	const result = await importObsidianVault({
		destinationPath: destination,
		onProgress: options.onProgress,
		signal: options.signal,
		sourcePath: options.folder.path,
		vaultPath: vault.path,
	})
	await useVaultStore.getState().refreshFiles()
	const applied = result.cancelled
		? null
		: await applyVaultSettingsImport(vault, result.settings, {
				applyVaultSettings: options.applySettings,
			})
	const outcome = toOutcome(result, applied, options, destinationLabel)
	if (!result.cancelled) await writeReportNote(destination, outcome, result)
	return outcome
}
