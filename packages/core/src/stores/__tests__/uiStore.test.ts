import { beforeEach, describe, expect, it } from "vitest"
import { clampLeftSidebarWidth, LEFT_SIDEBAR_WIDTH_BOUNDS, useUIStore } from "../../stores/uiStore"

describe("uiStore sidebar layout", () => {
	beforeEach(() => {
		useUIStore.getState().resetLeftSidebarLayout()
	})

	it("clamps sidebar width to the exported bounds", () => {
		expect(clampLeftSidebarWidth(LEFT_SIDEBAR_WIDTH_BOUNDS.min - 80)).toBe(
			LEFT_SIDEBAR_WIDTH_BOUNDS.min,
		)
		expect(clampLeftSidebarWidth(LEFT_SIDEBAR_WIDTH_BOUNDS.max + 80)).toBe(
			LEFT_SIDEBAR_WIDTH_BOUNDS.max,
		)
		expect(clampLeftSidebarWidth(280)).toBe(280)
	})

	it("uses the same clamp when storing sidebar width", () => {
		useUIStore.getState().setLeftSidebarWidth(LEFT_SIDEBAR_WIDTH_BOUNDS.max + 20)
		expect(useUIStore.getState().leftSidebarWidth).toBe(LEFT_SIDEBAR_WIDTH_BOUNDS.max)
	})
})
