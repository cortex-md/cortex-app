import { getPlatform, type FileEntry } from "@cortex/platform"
import { builtInExporters, builtInImporters } from "./builtins"
import {
	getExtension,
	getParentPath,
	getPathName,
	reserveUniquePath,
	sanitizeFileStem,
	splitExtension,
} from "./path"
import {
	exporterRegistry,
	importerRegistry,
	type Exporter,
	type Importer,
	type TransferFormat,
} from "./registry"

export interface ImportBatchOptions {
	vaultPath: string
	sourcePaths: string[]
	destinationPath?: string
	existingFiles?: FileEntry[]
	concurrency?: number
}

export interface ImportFileResult {
	sourcePath: string
	targetPath?: string
	attachmentPath?: string
	format?: string
	status: "imported" | "skipped" | "failed"
	error?: string
}

export interface ImportBatchResult {
	results: ImportFileResult[]
	importedCount: number
	skippedCount: number
	failedCount: number
}

export interface ExportNoteOptions {
	sourcePath: string
	format: TransferFormat | string
	targetPath?: string
	title?: string
	markdown?: string
}

export interface ExportNoteResult {
	sourcePath: string
	format: string
	targetPath?: string
}

interface PlannedImport {
	importer: Importer
	sourcePath: string
	targetPath: string
	attachmentPath?: string
}

const defaultConcurrency = 4
let registeredBuiltIns = false

export function ensureBuiltInTransferFormats(): void {
	if (registeredBuiltIns) return
	for (const importer of builtInImporters) importerRegistry.register(importer)
	for (const exporter of builtInExporters) exporterRegistry.register(exporter)
	registeredBuiltIns = true
}

export async function importFiles(options: ImportBatchOptions): Promise<ImportBatchResult> {
	ensureBuiltInTransferFormats()
	const platform = getPlatform()
	const destinationPath = options.destinationPath ?? options.vaultPath
	const files = options.existingFiles ?? (await platform.vault.scanVault(options.vaultPath))
	const reservedPaths = new Set(files.map((file) => file.path))
	const plans = options.sourcePaths.map((sourcePath): PlannedImport | ImportFileResult => {
		const extension = getExtension(sourcePath)
		const importer = importerRegistry.getByExtension(extension)
		if (!importer) {
			return {
				sourcePath,
				status: "skipped",
				error: `Unsupported import format: ${extension || "unknown"}`,
			}
		}

		const stem = sanitizeFileStem(splitExtension(getPathName(sourcePath)).baseName)
		const targetPath = reserveUniquePath(destinationPath, `${stem}.md`, reservedPaths)
		return { importer, sourcePath, targetPath }
	})

	const results: ImportFileResult[] = plans.filter(isImportFileResult)
	const plannedImports = plans.filter(isPlannedImport)
	const importedResults = await runBounded(plannedImports, options.concurrency, async (plan) => {
		try {
			const output = await plan.importer.importFile({
				sourcePath: plan.sourcePath,
				targetPath: plan.targetPath,
				vaultPath: options.vaultPath,
				attachmentPath: plan.attachmentPath,
			})
			await platform.fs.atomicWriteFile(plan.targetPath, output.content)
			return {
				sourcePath: plan.sourcePath,
				targetPath: plan.targetPath,
				attachmentPath: output.attachment?.targetPath,
				format: plan.importer.id,
				status: "imported" as const,
			}
		} catch (error) {
			return {
				sourcePath: plan.sourcePath,
				targetPath: plan.targetPath,
				attachmentPath: plan.attachmentPath,
				format: plan.importer.id,
				status: "failed" as const,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	})

	const allResults = [...results, ...importedResults]
	return {
		results: allResults,
		importedCount: allResults.filter((result) => result.status === "imported").length,
		skippedCount: allResults.filter((result) => result.status === "skipped").length,
		failedCount: allResults.filter((result) => result.status === "failed").length,
	}
}

export async function exportNote(options: ExportNoteOptions): Promise<ExportNoteResult> {
	ensureBuiltInTransferFormats()
	const platform = getPlatform()
	const exporter = exporterRegistry.get(options.format)
	if (!exporter) throw new Error(`Unsupported export format: ${options.format}`)

	const markdown = options.markdown ?? (await platform.fs.readFile(options.sourcePath))
	const title = options.title ?? splitExtension(getPathName(options.sourcePath)).baseName
	const output = await exporter.exportFile({
		sourcePath: options.sourcePath,
		targetPath: options.targetPath,
		title,
		markdown,
	})

	if (output.pdfHtml) {
		if (!options.targetPath) throw new Error("Export target path is required")
		if (!platform.documentExport?.exportHtmlToPdf) {
			throw new Error("This platform cannot export PDF files")
		}
		await platform.documentExport.exportHtmlToPdf({
			html: output.pdfHtml,
			targetPath: options.targetPath,
			title,
		})
		return {
			sourcePath: options.sourcePath,
			format: exporter.id,
			targetPath: options.targetPath,
		}
	}

	if (!options.targetPath) throw new Error("Export target path is required")
	await platform.fs.atomicWriteFile(options.targetPath, output.content)
	return {
		sourcePath: options.sourcePath,
		format: exporter.id,
		targetPath: options.targetPath,
	}
}

export function getExportDefaultFileName(sourcePath: string, exporter: Exporter): string {
	const title = sanitizeFileStem(splitExtension(getPathName(sourcePath)).baseName)
	return `${title}.${exporter.extension}`
}

export function getImporterDialogFilters() {
	ensureBuiltInTransferFormats()
	return importerRegistry.getAll().map((importer) => ({
		name: importer.label,
		extensions: [...importer.extensions],
	}))
}

export function getExporter(format: string): Exporter | undefined {
	ensureBuiltInTransferFormats()
	return exporterRegistry.get(format)
}

function isPlannedImport(value: PlannedImport | ImportFileResult): value is PlannedImport {
	return "importer" in value
}

function isImportFileResult(value: PlannedImport | ImportFileResult): value is ImportFileResult {
	return "status" in value
}

async function runBounded<T, R>(
	items: T[],
	concurrency = defaultConcurrency,
	worker: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length)
	let nextIndex = 0
	const workerCount = Math.max(1, Math.min(concurrency, items.length || 1))
	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (nextIndex < items.length) {
				const currentIndex = nextIndex
				nextIndex += 1
				results[currentIndex] = await worker(items[currentIndex])
			}
		}),
	)
	return results
}

export function resolveSiblingExportPath(sourcePath: string, exporter: Exporter): string {
	return `${getParentPath(sourcePath)}/${getExportDefaultFileName(sourcePath, exporter)}`
}
