import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const lifecycleMocks = vi.hoisted(() => ({
	createDir: vi.fn(),
	startWatching: vi.fn(),
	stopWatching: vi.fn(),
	disableAllPlugins: vi.fn(),
	loadEnabledPlugins: vi.fn(),
	discoverCommunityPlugins: vi.fn(),
	reloadCommunityPlugins: vi.fn(),
	setCommunityPluginsDir: vi.fn(),
	reportAppError: vi.fn(),
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => ({
		fs: {
			createDir: lifecycleMocks.createDir,
			startWatching: lifecycleMocks.startWatching,
		},
	}),
}))

vi.mock("@cortex/plugin-host-core", () => ({
	disableAllPlugins: lifecycleMocks.disableAllPlugins,
	loadEnabledPlugins: lifecycleMocks.loadEnabledPlugins,
}))

vi.mock("@cortex/plugin-host-web", () => ({
	discoverCommunityPlugins: lifecycleMocks.discoverCommunityPlugins,
	reloadCommunityPlugins: lifecycleMocks.reloadCommunityPlugins,
	setCommunityPluginsDir: lifecycleMocks.setCommunityPluginsDir,
}))

vi.mock("../../utils/reportAppError", () => ({
	reportAppError: lifecycleMocks.reportAppError,
}))

import { useCommunityPluginLifecycle } from "../../hooks/useCommunityPluginLifecycle"

const vault = { path: "/vault", name: "Vault", uuid: "vault-id", fileCount: 0 }

function createDeferred() {
	let resolve!: () => void
	const promise = new Promise<void>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

beforeEach(() => {
	lifecycleMocks.createDir.mockResolvedValue(undefined)
	lifecycleMocks.startWatching.mockResolvedValue(lifecycleMocks.stopWatching)
	lifecycleMocks.disableAllPlugins.mockResolvedValue(undefined)
	lifecycleMocks.loadEnabledPlugins.mockResolvedValue(undefined)
	lifecycleMocks.discoverCommunityPlugins.mockResolvedValue(undefined)
	lifecycleMocks.reloadCommunityPlugins.mockResolvedValue(undefined)
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.clearAllMocks()
})

describe("useCommunityPluginLifecycle", () => {
	it("does not enable plugins after initialization is cancelled", async () => {
		const discovery = createDeferred()
		lifecycleMocks.discoverCommunityPlugins.mockReturnValueOnce(discovery.promise)

		const { unmount } = renderHook(() => useCommunityPluginLifecycle(vault))

		await waitFor(() => {
			expect(lifecycleMocks.discoverCommunityPlugins).toHaveBeenCalledWith("/vault/.cortex/plugins")
		})

		unmount()

		await act(async () => {
			discovery.resolve()
			await discovery.promise
			await Promise.resolve()
		})

		expect(lifecycleMocks.disableAllPlugins).toHaveBeenCalledTimes(1)
		expect(lifecycleMocks.loadEnabledPlugins).not.toHaveBeenCalled()
		expect(lifecycleMocks.startWatching).not.toHaveBeenCalled()
	})

	it("ignores plugin runtime settings and data file changes", async () => {
		renderHook(() => useCommunityPluginLifecycle(vault))

		await waitFor(() => {
			expect(lifecycleMocks.startWatching).toHaveBeenCalled()
		})
		vi.useFakeTimers()
		const onPluginFileEvent = lifecycleMocks.startWatching.mock.calls[0][1]

		act(() => {
			onPluginFileEvent({
				path: "/vault/.cortex/plugins/note-pulse/settings.json",
				kind: "modified",
			})
			onPluginFileEvent({
				path: "/vault/.cortex/plugins/note-pulse/data/report-cache.json",
				kind: "modified",
			})
			onPluginFileEvent({
				path: "/vault/.cortex/plugins/.note-pulse-install-123/manifest.json",
				kind: "created",
			})
			vi.advanceTimersByTime(350)
		})

		expect(lifecycleMocks.reloadCommunityPlugins).not.toHaveBeenCalled()
	})

	it("reloads community plugins when plugin bundle files change", async () => {
		renderHook(() => useCommunityPluginLifecycle(vault))

		await waitFor(() => {
			expect(lifecycleMocks.startWatching).toHaveBeenCalled()
		})
		vi.useFakeTimers()
		const onPluginFileEvent = lifecycleMocks.startWatching.mock.calls[0][1]

		act(() => {
			onPluginFileEvent({
				path: "/vault/.cortex/plugins/note-pulse/manifest.json",
				kind: "modified",
			})
			vi.advanceTimersByTime(350)
		})

		expect(lifecycleMocks.reloadCommunityPlugins).toHaveBeenCalledWith(
			"/vault/.cortex/plugins",
			expect.any(Function),
		)
	})
})
