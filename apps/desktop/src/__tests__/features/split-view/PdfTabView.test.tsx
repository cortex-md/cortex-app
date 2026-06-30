import type { Tab } from "@cortex/core"
import { useWorkspaceStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PdfTabView } from "../../../features/split-view/PdfTabView"
import { PdfRenderCache, renderPdfPageSnapshot } from "../../../features/split-view/pdfViewer"
import { clearPdfRenderCacheForTests } from "../../../features/split-view/usePdfPageRenderer"

const pdfMocks = vi.hoisted(() => {
	class MockPasswordException extends Error {}
	class MockRenderingCancelledException extends Error {}
	return {
		renderCancel: vi.fn(),
		destroy: vi.fn(),
		getPage: vi.fn(),
		render: vi.fn(),
		getViewport: vi.fn(),
		getDocument: vi.fn(),
		PasswordException: MockPasswordException,
		RenderingCancelledException: MockRenderingCancelledException,
	}
})

vi.mock("pdfjs-dist", () => ({
	GlobalWorkerOptions: {},
	getDocument: pdfMocks.getDocument,
	PasswordException: pdfMocks.PasswordException,
	RenderingCancelledException: pdfMocks.RenderingCancelledException,
}))

vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({
	default: "/assets/pdf.worker.mjs",
}))

type MockPlatform = ReturnType<typeof createPlatformMock>

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (error: unknown) => void
}

const rootPaneId = "root"
let platformMock: MockPlatform

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve
		reject = promiseReject
	})
	return { promise, resolve, reject }
}

function createPlatformMock() {
	return {
		fs: {
			readBinaryFile: vi.fn().mockResolvedValue([37, 80, 68, 70]),
		},
		app: {
			resolveFileAssetUrl: vi.fn((path: string) => `asset://${path}`),
		},
		dialog: {
			revealFolder: vi.fn().mockResolvedValue(undefined),
		},
	}
}

function createTab(overrides: Partial<Tab> = {}): Tab {
	return {
		id: "pdf-tab",
		tabType: "file",
		fileKind: "pdf",
		filePath: "/vault/source.pdf",
		viewId: null,
		viewState: null,
		title: "source.pdf",
		isPinned: false,
		isDirty: false,
		isEphemeral: false,
		lastAccessed: 1,
		isSuspended: false,
		...overrides,
	}
}

function setWorkspaceTab(tab = createTab()) {
	useWorkspaceStore.setState({
		panes: {
			[rootPaneId]: {
				id: rootPaneId,
				activeTabId: tab.id,
				tabs: [tab],
			},
		},
		splitTree: { type: "leaf", id: rootPaneId },
		activePaneId: rootPaneId,
		mruOrder: [tab.id],
		recentlyClosed: [],
	})
}

function PdfHarness() {
	const tab = useWorkspaceStore((state) => state.panes[rootPaneId].tabs[0])
	return <PdfTabView tab={tab} paneId={rootPaneId} isActive />
}

function createMockDocument(pageCount = 4) {
	return {
		numPages: pageCount,
		getPage: pdfMocks.getPage,
	}
}

function createLoadingTask(document = createMockDocument()) {
	return {
		promise: Promise.resolve(document),
		destroy: pdfMocks.destroy,
		onProgress: null as ((progress: { loaded: number; total?: number }) => void) | null,
	}
}

function mockReadyDocument(pageCount = 4) {
	const document = createMockDocument(pageCount)
	const loadingTask = createLoadingTask(document)
	pdfMocks.getViewport.mockImplementation(({ scale }: { scale: number }) => ({
		width: 100 * scale,
		height: 140 * scale,
	}))
	pdfMocks.render.mockReturnValue({ promise: Promise.resolve(), cancel: pdfMocks.renderCancel })
	pdfMocks.getPage.mockResolvedValue({
		getViewport: pdfMocks.getViewport,
		render: pdfMocks.render,
	})
	pdfMocks.getDocument.mockReturnValue(loadingTask)
	return { document, loadingTask }
}

async function flushReactWork(): Promise<void> {
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
		await Promise.resolve()
	})
}

beforeEach(() => {
	clearPdfRenderCacheForTests()
	setWorkspaceTab()
	platformMock = createPlatformMock()
	vi.mocked(getPlatform).mockReturnValue(platformMock as unknown as ReturnType<typeof getPlatform>)
	mockReadyDocument()
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		clearRect: vi.fn(),
		drawImage: vi.fn(),
		setTransform: vi.fn(),
	} as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.clearAllMocks()
	clearPdfRenderCacheForTests()
})

describe("PdfTabView", () => {
	it("loads the PDF through a local asset URL before rendering the first page", async () => {
		render(<PdfHarness />)

		await waitFor(() => expect(pdfMocks.getPage).toHaveBeenCalledWith(1))

		expect(platformMock.app.resolveFileAssetUrl).toHaveBeenCalledWith("/vault/source.pdf")
		expect(pdfMocks.getDocument).toHaveBeenCalledWith({ url: "asset:///vault/source.pdf" })
		expect(platformMock.fs.readBinaryFile).not.toHaveBeenCalled()
		expect(pdfMocks.render).toHaveBeenCalled()
		expect(screen.getByLabelText("Page number")).toHaveValue("1")
	})

	it("falls back to binary loading when the asset URL cannot be opened", async () => {
		const assetUrlTask = {
			promise: Promise.reject(new Error("asset failed")),
			destroy: pdfMocks.destroy,
			onProgress: null,
		}
		const binaryTask = createLoadingTask(createMockDocument())
		pdfMocks.getDocument.mockReturnValueOnce(assetUrlTask).mockReturnValueOnce(binaryTask)

		render(<PdfHarness />)

		await waitFor(() => expect(pdfMocks.getPage).toHaveBeenCalledWith(1))

		expect(pdfMocks.getDocument).toHaveBeenNthCalledWith(1, {
			url: "asset:///vault/source.pdf",
		})
		expect(platformMock.fs.readBinaryFile).toHaveBeenCalledWith("/vault/source.pdf")
		expect(pdfMocks.getDocument).toHaveBeenNthCalledWith(2, { data: expect.any(Uint8Array) })
	})

	it("cancels the active render when the user changes page before it finishes", async () => {
		const renderDeferred = createDeferred<void>()
		pdfMocks.render.mockReturnValueOnce({
			promise: renderDeferred.promise,
			cancel: pdfMocks.renderCancel,
		})

		render(<PdfHarness />)
		await waitFor(() => expect(pdfMocks.render).toHaveBeenCalledTimes(1))

		fireEvent.click(screen.getByLabelText("Next page"))

		await waitFor(() => expect(pdfMocks.renderCancel).toHaveBeenCalled())
		renderDeferred.resolve()
	})

	it("reuses a cached page snapshot without asking PDF.js to render it again", async () => {
		const cache = new PdfRenderCache({ maxEntries: 5, maxPixels: 24_000_000 })
		const document = createMockDocument()

		await renderPdfPageSnapshot({
			filePath: "/vault/source.pdf",
			document: document as unknown as PDFDocumentProxy,
			pageNumber: 1,
			zoom: 1,
			cache,
		})
		await renderPdfPageSnapshot({
			filePath: "/vault/source.pdf",
			document: document as unknown as PDFDocumentProxy,
			pageNumber: 1,
			zoom: 1,
			cache,
		})

		expect(pdfMocks.getPage).toHaveBeenCalledTimes(2)
		expect(pdfMocks.render).toHaveBeenCalledTimes(1)
	})

	it("prefetches the next page after the current page is ready", async () => {
		vi.useFakeTimers()
		mockReadyDocument(3)

		render(<PdfHarness />)
		await flushReactWork()

		expect(pdfMocks.getPage).toHaveBeenCalledWith(1)
		expect(pdfMocks.getPage).not.toHaveBeenCalledWith(2)

		await act(async () => {
			vi.advanceTimersByTime(80)
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(pdfMocks.getPage).toHaveBeenCalledWith(2)
	})

	it("debounces high-quality rerendering while applying zoom state immediately", async () => {
		vi.useFakeTimers()
		mockReadyDocument(1)

		render(<PdfHarness />)
		await flushReactWork()

		const renderCountBeforeZoom = pdfMocks.render.mock.calls.length
		fireEvent.click(screen.getByLabelText("Zoom in"))

		expect(screen.getByText("125%")).toBeInTheDocument()
		expect(pdfMocks.render).toHaveBeenCalledTimes(renderCountBeforeZoom)

		await act(async () => {
			vi.advanceTimersByTime(149)
			await Promise.resolve()
		})
		expect(pdfMocks.render).toHaveBeenCalledTimes(renderCountBeforeZoom)

		await act(async () => {
			vi.advanceTimersByTime(1)
			await Promise.resolve()
			await Promise.resolve()
		})
		expect(pdfMocks.render.mock.calls.length).toBeGreaterThan(renderCountBeforeZoom)
	})

	it("shows a recoverable error when the document cannot load", async () => {
		pdfMocks.getDocument.mockReturnValue({
			promise: Promise.reject(new pdfMocks.PasswordException("password")),
			destroy: pdfMocks.destroy,
			onProgress: null,
		})

		render(<PdfHarness />)

		expect(
			await screen.findByText("This PDF is password protected and cannot be opened yet."),
		).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Reveal file" })).toBeInTheDocument()
	})
})
