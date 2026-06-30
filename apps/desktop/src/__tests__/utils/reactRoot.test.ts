import type { Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createDeferredRootUnmount } from "../../utils/reactRoot"

afterEach(() => {
	vi.useRealTimers()
})

describe("createDeferredRootUnmount", () => {
	it("defers root unmount and keeps disposal idempotent", () => {
		vi.useFakeTimers()
		const unmount = vi.fn()
		const dispose = createDeferredRootUnmount({ unmount } as unknown as Root)

		dispose()
		dispose()

		expect(unmount).not.toHaveBeenCalled()

		vi.runAllTimers()

		expect(unmount).toHaveBeenCalledTimes(1)
	})
})
