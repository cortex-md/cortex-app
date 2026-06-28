import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const openMarketplaceView = vi.hoisted(() => vi.fn())
const ensureCommunityThemeCssLoaded = vi.hoisted(() => vi.fn(async () => undefined))
const reportAppError = vi.hoisted(() => vi.fn())

vi.mock("../../../features/marketplace/openMarketplaceView", () => ({
	openMarketplaceView,
}))

vi.mock("../../../features/themes/communityThemeLoader", () => ({
	ensureCommunityThemeCssLoaded,
}))

vi.mock("../../../utils/reportAppError", () => ({
	reportAppError,
}))

import { getPlatform } from "@cortex/platform"
import type { AppearanceSettings } from "@cortex/settings"
import {
	DEFAULT_ACCENT_COLOR,
	DEFAULT_APPEARANCE_SETTINGS,
	SYSTEM_FONT_FAMILY,
	SYSTEM_FONT_STACK,
} from "@cortex/settings/defaults"
import { getContrastRatio, getThemeManager } from "@cortex/theme"
import { AppearanceSection } from "../../../features/settings/AppearanceSettings"
import { buildAppearanceOverrides } from "../../../features/settings/applyAppearance"

const onUpdate = vi.fn()
const restartApp = vi.fn()

const appearanceSettings: AppearanceSettings = { ...DEFAULT_APPEARANCE_SETTINGS }

function setupAppearance() {
	vi.mocked(getPlatform).mockReturnValue({
		font: {
			listSystemFonts: vi.fn().mockResolvedValue([{ family: "Inter" }]),
		},
		window: {
			restartApp,
		},
	} as never)
}

afterEach(() => {
	cleanup()
	getThemeManager().unregisterTheme("quiet-theme")
	vi.clearAllMocks()
})

describe("AppearanceSection", () => {
	it("opens the workspace Marketplace on the themes tab", async () => {
		setupAppearance()
		render(<AppearanceSection settings={appearanceSettings} onUpdate={onUpdate} />)

		await userEvent.click(screen.getByRole("button", { name: "Browse themes" }))

		expect(openMarketplaceView).toHaveBeenCalledWith("themes")
	})

	it("opens the selected community theme directly in Marketplace", async () => {
		setupAppearance()
		getThemeManager().registerCommunityFamily({
			name: "quiet-theme",
			displayName: "Quiet Theme",
			darkTheme: "quiet-theme-dark",
			lightTheme: "quiet-theme-light",
		})

		render(
			<AppearanceSection
				settings={{ ...appearanceSettings, theme: "quiet-theme" }}
				onUpdate={onUpdate}
			/>,
		)

		await userEvent.click(screen.getByRole("button", { name: "View" }))

		expect(openMarketplaceView).toHaveBeenCalledWith("themes", {
			selectedEntryId: "quiet-theme",
		})
	})

	it("uses theme swatches and custom color updates for accent color", async () => {
		setupAppearance()
		const themeManager = getThemeManager()
		const applyOverrides = vi.spyOn(themeManager, "applyOverrides")

		render(<AppearanceSection settings={appearanceSettings} onUpdate={onUpdate} />)

		const successSwatch = await screen.findByRole("button", {
			name: "Success (#4a9b7a)",
		})
		await userEvent.click(successSwatch)

		expect(onUpdate).toHaveBeenCalledWith("appearance", "accentColor", "#4a9b7a")
		expect(applyOverrides).toHaveBeenCalled()

		fireEvent.change(screen.getByLabelText("Accent Color"), {
			target: { value: "#3b82f6" },
		})

		await waitFor(() => {
			expect(onUpdate).toHaveBeenCalledWith("appearance", "accentColor", "#3b82f6")
		})
	})

	it("reports async appearance apply failures from theme selectors", async () => {
		setupAppearance()
		const firstError = new Error("Dark stylesheet missing")
		const secondError = new Error("Light stylesheet missing")
		ensureCommunityThemeCssLoaded
			.mockRejectedValueOnce(firstError)
			.mockRejectedValueOnce(secondError)
		getThemeManager().registerCommunityFamily({
			name: "quiet-theme",
			displayName: "Quiet Theme",
			darkTheme: "quiet-theme-dark",
			lightTheme: "quiet-theme-light",
		})

		render(
			<AppearanceSection
				settings={{ ...appearanceSettings, colorscheme: "light" }}
				onUpdate={onUpdate}
			/>,
		)

		fireEvent.change(screen.getByLabelText("Theme"), {
			target: { value: "quiet-theme" },
		})
		fireEvent.change(screen.getByLabelText("Colorscheme"), {
			target: { value: "dark" },
		})

		expect(onUpdate).toHaveBeenCalledWith("appearance", "theme", "quiet-theme")
		expect(onUpdate).toHaveBeenCalledWith("appearance", "colorscheme", "dark")
		await waitFor(() => {
			expect(reportAppError).toHaveBeenCalledTimes(2)
		})
		expect(reportAppError).toHaveBeenNthCalledWith(1, {
			operation: "apply-appearance-settings",
			source: "appearance-settings",
			cause: firstError,
		})
		expect(reportAppError).toHaveBeenNthCalledWith(2, {
			operation: "apply-appearance-settings",
			source: "appearance-settings",
			cause: secondError,
		})
	})

	it("keeps line height out of settings UI and runtime overrides", async () => {
		setupAppearance()
		render(<AppearanceSection settings={appearanceSettings} onUpdate={onUpdate} />)

		expect(await screen.findAllByRole("option", { name: "Inter" })).toHaveLength(2)
		expect(screen.getByLabelText("UI font")).toBeInTheDocument()
		expect(screen.getByText("UI font size")).toBeInTheDocument()
		expect(screen.getByLabelText("Native window effects")).toBeChecked()
		expect(screen.getByLabelText("Editor font")).toBeInTheDocument()
		expect(screen.getByText("Editor font size")).toBeInTheDocument()
		expect(screen.queryByText("Line Height")).not.toBeInTheDocument()

		const overrides = buildAppearanceOverrides({ ...appearanceSettings, lineHeight: 1.8 })

		expect(overrides).not.toHaveProperty("--ui-line-height")
		expect(overrides).not.toHaveProperty("--editor-line-height")
		expect(overrides).not.toHaveProperty("--ui-font-weight")
		expect(overrides).not.toHaveProperty("--editor-font-weight")
	})

	it("updates native window effects and offers a restart", async () => {
		setupAppearance()
		render(<AppearanceSection settings={appearanceSettings} onUpdate={onUpdate} />)

		await userEvent.click(screen.getByLabelText("Native window effects"))

		expect(onUpdate).toHaveBeenCalledWith("appearance", "nativeWindowEffects", false)

		await userEvent.click(await screen.findByRole("button", { name: "Restart now" }))

		expect(restartApp).toHaveBeenCalled()
	})

	it("keeps default appearance values owned by the active theme", () => {
		const overrides = buildAppearanceOverrides(DEFAULT_APPEARANCE_SETTINGS)

		expect(DEFAULT_APPEARANCE_SETTINGS.accentColor).toBe(DEFAULT_ACCENT_COLOR)
		expect(DEFAULT_APPEARANCE_SETTINGS.uiFontFamily).toBe(SYSTEM_FONT_FAMILY)
		expect(overrides).toEqual({})
		expect(overrides).not.toHaveProperty("--font-ui")
		expect(overrides).not.toHaveProperty("--ui-font-size")
		expect(overrides).not.toHaveProperty("--font-editor")
		expect(overrides).not.toHaveProperty("--editor-font-size")
		expect(overrides).not.toHaveProperty("--accent")
		expect(overrides).not.toHaveProperty("--brand")
		expect(overrides).not.toHaveProperty("--ui-line-height")
		expect(overrides).not.toHaveProperty("--editor-line-height")
		expect(overrides).not.toHaveProperty("--ui-font-weight")
		expect(overrides).not.toHaveProperty("--editor-font-weight")
	})

	it("emits typography overrides only for explicit non-default preferences", () => {
		expect(
			buildAppearanceOverrides({
				...appearanceSettings,
				uiFontFamily: "Inter",
			}),
		).toEqual({
			"--font-ui": `"Inter", ${SYSTEM_FONT_STACK}`,
		})
		expect(
			buildAppearanceOverrides({
				...appearanceSettings,
				uiFontSize: 15,
			}),
		).toEqual({
			"--ui-font-size": "15px",
		})
		expect(
			buildAppearanceOverrides({
				...appearanceSettings,
				editorFontFamily: "JetBrains Mono",
			}),
		).toEqual({
			"--font-editor": `"JetBrains Mono", ${SYSTEM_FONT_STACK}`,
		})
		expect(
			buildAppearanceOverrides({
				...appearanceSettings,
				editorFontSize: 17,
			}),
		).toEqual({
			"--editor-font-size": "17px",
		})
	})

	it("updates every accent foreground used by primary controls", () => {
		getThemeManager().setActiveTheme("paper")
		const overrides = buildAppearanceOverrides({
			...appearanceSettings,
			accentColor: "#ffd400",
		})

		expect(overrides["--accent"]).toBe("#ffd400")
		expect(overrides["--text-on-accent"]).toBe("#0a0a09")
		expect(overrides["--primary"]).toBe("#ffd400")
		expect(overrides["--primary-foreground"]).toBe("#0a0a09")
		expect(overrides["--btn-primary-text"]).toBe("#0a0a09")
		expect(overrides["--sidebar-primary"]).toBe("#ffd400")
		expect(overrides["--sidebar-primary-foreground"]).toBe("#0a0a09")
		expect(overrides["--brand"]).toBe("#ffd400")
		expect(overrides["--brand-border"]).toBe("#ffd400")
		expect(overrides["--brand-subtle"]).toBe(overrides["--accent-subtle"])
		expect(overrides["--brand-text"]).toBe(overrides["--accent-text"])
		expect(overrides["--ring"]).toBe(overrides["--border-focus"])
		expect(overrides["--chart-1"]).toBe("#ffd400")
		expect(getContrastRatio(overrides["--border-focus"], "#fbfbfc")).toBeGreaterThanOrEqual(3)
	})
})
