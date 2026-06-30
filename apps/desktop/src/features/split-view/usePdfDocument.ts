import { getPlatform } from "@cortex/platform"
import { getDocument, PasswordException, type PDFDocumentProxy } from "pdfjs-dist"
import { useEffect, useState } from "react"

export type PdfLoadSource = "asset-url" | "binary-fallback"

export interface LoadingProgress {
	loaded: number
	total: number | null
}

export type PdfDocumentStatus =
	| { type: "loading" }
	| { type: "ready"; document: PDFDocumentProxy; source: PdfLoadSource }
	| { type: "error"; message: string }

export interface UsePdfDocumentResult {
	documentStatus: PdfDocumentStatus
	loadingProgress: LoadingProgress | null
}

function isPasswordError(error: unknown): boolean {
	return error instanceof PasswordException
}

export function getPdfErrorMessage(error: unknown): string {
	if (isPasswordError(error)) {
		return "This PDF is password protected and cannot be opened yet."
	}
	if (error instanceof Error && error.message) {
		return error.message
	}
	return "The PDF could not be opened."
}

export function getProgressValue(progress: LoadingProgress | null): number | undefined {
	if (!progress?.total) return undefined
	return Math.min(Math.max((progress.loaded / progress.total) * 100, 0), 100)
}

async function readPdfFileData(filePath: string): Promise<Uint8Array> {
	const platform = getPlatform()
	if (!platform.fs.readBinaryFile) {
		throw new Error("This platform cannot read PDF files yet.")
	}

	const bytes = await platform.fs.readBinaryFile(filePath)
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

function readPdfProgress({ loaded, total }: { loaded: number; total?: number }): LoadingProgress {
	return { loaded, total: total && total > 0 ? total : null }
}

export function usePdfDocument(filePath: string): UsePdfDocumentResult {
	const [documentStatus, setDocumentStatus] = useState<PdfDocumentStatus>({ type: "loading" })
	const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null)

	useEffect(() => {
		let active = true
		let loadingTask: ReturnType<typeof getDocument> | null = null

		function destroyLoadingTask(): void {
			const currentLoadingTask = loadingTask
			loadingTask = null
			void currentLoadingTask?.destroy()
		}

		function attachProgressHandler(): void {
			if (!loadingTask) return
			loadingTask.onProgress = (progress: { loaded: number; total?: number }) => {
				if (!active) return
				setLoadingProgress(readPdfProgress(progress))
			}
		}

		async function loadFromBinaryFallback(): Promise<void> {
			const data = await readPdfFileData(filePath)
			if (!active) return
			loadingTask = getDocument({ data })
			attachProgressHandler()
			const document = await loadingTask.promise
			if (!active) return
			setDocumentStatus({ type: "ready", document, source: "binary-fallback" })
		}

		async function load(): Promise<void> {
			setDocumentStatus({ type: "loading" })
			setLoadingProgress(null)

			try {
				const url = getPlatform().app.resolveFileAssetUrl(filePath)
				loadingTask = getDocument({ url })
				attachProgressHandler()
				const document = await loadingTask.promise
				if (!active) return
				setDocumentStatus({ type: "ready", document, source: "asset-url" })
			} catch (assetUrlError) {
				if (!active) return
				destroyLoadingTask()
				if (isPasswordError(assetUrlError)) {
					setDocumentStatus({ type: "error", message: getPdfErrorMessage(assetUrlError) })
					return
				}

				try {
					await loadFromBinaryFallback()
				} catch (binaryError) {
					if (!active) return
					setDocumentStatus({ type: "error", message: getPdfErrorMessage(binaryError) })
				}
			}
		}

		void load()

		return () => {
			active = false
			destroyLoadingTask()
		}
	}, [filePath])

	return { documentStatus, loadingProgress }
}
