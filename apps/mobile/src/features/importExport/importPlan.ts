import type { FileEntry } from "@cortex/platform"
import { getParentPath, joinPath, splitExtension } from "@cortex/platform/utils"
import type { ObsidianFindingKind } from "@cortex/import-export"

import type {
	ConflictPolicy,
	CsvMode,
	ImportDestination,
	ImportFileKind,
	ImportSourceFile,
	ObsidianMode,
	PlannedImportFile,
} from "@/features/importExport/importTypes"

const KIND_BY_EXTENSION: Record<string, ImportFileKind> = {
	csv: "csv",
	htm: "html",
	html: "html",
	pdf: "pdf",
}

const UNSUPPORTED_LABELS: Record<string, string> = {
	doc: "Word",
	docx: "Word",
	key: "Keynote",
	md: "Markdown",
	pages: "Pages",
	ppt: "PowerPoint",
	pptx: "PowerPoint",
}

export const FINDING_LABELS: Record<ObsidianFindingKind, string> = {
	"attachment-link": "Links to non-note files",
	"attachment-setting": "Attachment folder relative to each note",
	"block-id": "Block IDs shown as text",
	bookmark: "Bookmarks that are not notes",
	canvas: "Canvas files",
	comment: "Comments shown as text",
	"community-plugin": "Community plugins",
	dataview: "Dataview queries",
	"date-format": "Date formats Cortex cannot express",
	excalidraw: "Excalidraw drawings",
	"file-embed": "PDF, audio and video embeds",
	highlight: "Highlights shown as text",
	"image-embed": "Image embeds not rendered",
	"missing-attachment": "Embeds pointing to missing files",
	"note-embed": "Note embeds shown as links",
	"property-type": "Property types without a Cortex equivalent",
	templater: "Templater commands",
}

export function fileKindFromName(name: string): ImportFileKind {
	const extension = splitExtension(name).extension.replace(/^\./u, "").toLowerCase()
	return KIND_BY_EXTENSION[extension] ?? "unsupported"
}

export function extensionLabel(name: string): string {
	const extension = splitExtension(name).extension.replace(/^\./u, "").toLowerCase()
	return UNSUPPORTED_LABELS[extension] ?? extension.toUpperCase()
}

export function fileStem(name: string): string {
	return splitExtension(name).baseName
}

export function formatCount(value: number): string {
	return value.toLocaleString("en-US")
}

export function todayFolderName(): string {
	return new Date().toISOString().slice(0, 10)
}

export function buildDestinations(vaultPath: string, files: readonly FileEntry[]): ImportDestination[] {
	const topLevelFolders = files
		.filter((file) => file.isDir && getParentPath(file.path) === vaultPath && !file.name.startsWith("."))
		.map((file) => ({ label: file.name, relativePath: file.name }))
		.sort((left, right) => left.label.localeCompare(right.label))
	const imported = `Imported/${todayFolderName()}`
	return [
		{ label: `Imported / ${todayFolderName()}`, relativePath: imported },
		{ label: "Vault root", relativePath: "" },
		...topLevelFolders.filter((folder) => folder.relativePath !== "Imported"),
	]
}

export function destinationPath(vaultPath: string, destination: ImportDestination): string {
	return destination.relativePath ? joinPath(vaultPath, destination.relativePath) : vaultPath
}

function existingNames(vaultPath: string, destination: ImportDestination, files: readonly FileEntry[]) {
	const folder = destinationPath(vaultPath, destination)
	return new Set(
		files.filter((file) => getParentPath(file.path) === folder).map((file) => file.name.toLowerCase()),
	)
}

function uniqueName(name: string, taken: Set<string>): string {
	if (!taken.has(name.toLowerCase())) return name
	const { baseName, extension } = splitExtension(name)
	let suffix = 1
	let candidate = `${baseName} ${suffix}${extension}`
	while (taken.has(candidate.toLowerCase())) {
		suffix += 1
		candidate = `${baseName} ${suffix}${extension}`
	}
	return candidate
}

export function planImport(input: {
	files: readonly ImportSourceFile[]
	destination: ImportDestination
	conflict: ConflictPolicy
	csvMode: CsvMode
	vaultPath: string
	vaultFiles: readonly FileEntry[]
}): PlannedImportFile[] {
	const taken = existingNames(input.vaultPath, input.destination, input.vaultFiles)
	return input.files.map((file) => {
		const stem = fileStem(file.name)
		if (file.kind === "unsupported") {
			return {
				file,
				notes: 0,
				status: "skipped",
				targetLabel: `${file.extensionLabel} isn’t supported · export as PDF`,
				targetName: file.name,
			}
		}
		const isDatabase = file.kind === "csv" && input.csvMode === "database"
		const wanted = isDatabase ? stem : `${stem}.md`
		const exists = taken.has(wanted.toLowerCase())
		if (exists && input.conflict === "skip") {
			return { file, notes: 0, status: "skipped", targetLabel: "Already in the vault", targetName: wanted }
		}
		const targetName = uniqueName(wanted, taken)
		taken.add(targetName.toLowerCase())
		const notes = isDatabase ? Math.max(file.csvRowCount, 1) : 1
		const detail = isDatabase
			? `${targetName}/ · database, ${formatCount(notes)} notes`
			: exists
				? `${targetName} · name taken`
				: file.kind === "csv"
					? `${targetName} · table`
					: targetName
		return { file, notes, status: exists ? "warn" : "ok", targetLabel: detail, targetName }
	})
}

export function countPlannedNotes(plans: readonly PlannedImportFile[]): number {
	return plans.reduce((total, plan) => total + plan.notes, 0)
}

export function importableCount(plans: readonly PlannedImportFile[]): number {
	return plans.filter((plan) => plan.status !== "skipped").length
}

export function obsidianTitle(mode: ObsidianMode): string {
	return mode === "copy" ? "Import from Obsidian" : "Open an Obsidian vault"
}

export function previewPathLabel(
	plan: PlannedImportFile | undefined,
	destination: ImportDestination,
): string {
	if (!plan || plan.status === "skipped") return "Not imported"
	return `${destination.label} / ${plan.targetName}`
}
