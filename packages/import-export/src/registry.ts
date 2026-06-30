export type TransferFormat = "csv" | "html" | "pdf"

export interface ImporterInput {
	sourcePath: string
	targetPath: string
	vaultPath: string
	attachmentPath?: string
}

export interface ImporterOutput {
	content: string
	attachment?: {
		sourcePath: string
		targetPath: string
	}
}

export interface Importer {
	id: TransferFormat | string
	label: string
	extensions: readonly string[]
	plan?: (input: ImporterInput) => ImporterInput
	importFile: (input: ImporterInput) => Promise<ImporterOutput>
}

export interface ExporterInput {
	sourcePath: string
	title: string
	markdown: string
	targetPath?: string
}

export interface ExporterOutput {
	content: string
	extension: string
	mimeType: string
	pdfHtml?: string
}

export interface Exporter {
	id: TransferFormat | string
	label: string
	extension: string
	mimeType: string
	exportFile: (input: ExporterInput) => Promise<ExporterOutput>
}

export class ImporterRegistry {
	private importers = new Map<string, Importer>()

	register(importer: Importer): () => void {
		this.importers.set(importer.id, importer)
		return () => {
			if (this.importers.get(importer.id) === importer) this.importers.delete(importer.id)
		}
	}

	get(id: string): Importer | undefined {
		return this.importers.get(id)
	}

	getByExtension(extension: string): Importer | undefined {
		const normalized = extension.toLocaleLowerCase()
		return Array.from(this.importers.values()).find((importer) =>
			importer.extensions.some((value) => value.toLocaleLowerCase() === normalized),
		)
	}

	getAll(): Importer[] {
		return Array.from(this.importers.values())
	}
}

export class ExporterRegistry {
	private exporters = new Map<string, Exporter>()

	register(exporter: Exporter): () => void {
		this.exporters.set(exporter.id, exporter)
		return () => {
			if (this.exporters.get(exporter.id) === exporter) this.exporters.delete(exporter.id)
		}
	}

	get(id: string): Exporter | undefined {
		return this.exporters.get(id)
	}

	getAll(): Exporter[] {
		return Array.from(this.exporters.values())
	}
}

export const importerRegistry = new ImporterRegistry()
export const exporterRegistry = new ExporterRegistry()
