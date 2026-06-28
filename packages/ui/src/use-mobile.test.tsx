/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "./use-mobile"

const originalInnerWidth = window.innerWidth
const originalMatchMedia = window.matchMedia

let mediaQueryListeners: Array<() => void> = []

function setViewportWidth(width: number): void {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: width,
	})
}

beforeEach(() => {
	mediaQueryListeners = []
	window.matchMedia = vi.fn().mockImplementation(() => ({
		matches: window.innerWidth < 768,
		media: "(max-width: 767px)",
		onchange: null,
		addEventListener: (_event: string, listener: () => void) => {
			mediaQueryListeners.push(listener)
		},
		removeEventListener: (_event: string, listener: () => void) => {
			mediaQueryListeners = mediaQueryListeners.filter((current) => current !== listener)
		},
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}))
})

afterEach(() => {
	setViewportWidth(originalInnerWidth)
	window.matchMedia = originalMatchMedia
})

describe("useIsMobile", () => {
	it("reads the viewport snapshot during the first render", () => {
		setViewportWidth(500)

		const { result } = renderHook(() => useIsMobile())

		expect(result.current).toBe(true)
	})

	it("updates when the media query store changes", () => {
		setViewportWidth(900)
		const { result } = renderHook(() => useIsMobile())

		setViewportWidth(500)
		act(() => {
			for (const listener of mediaQueryListeners) listener()
		})

		expect(result.current).toBe(true)
	})
})
