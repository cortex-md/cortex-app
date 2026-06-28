import type { FileEntry } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	ensureCommunityThemeCssLoaded,
	loadCommunityThemes,
} from "../../../features/themes/communityThemeLoader"

const testState = vi.hoisted(() => ({
	directories: [] as FileEntry[],
	files: new Map<string, string>(),
	listDir: vi.fn(async (): Promise<FileEntry[]> => []),
	readFile: vi.fn(async (_path: string) => ""),
	registerCommunityFamily: vi.fn(),
	injectCSS: vi.fn(),
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: () => ({
		fs: {
			listDir: testState.listDir,
			readFile: testState.readFile,
		},
	}),
}))

vi.mock("@cortex/theme", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@cortex/theme")>()
	return {
		...actual,
		getThemeManager: () => ({
			registerCommunityFamily: testState.registerCommunityFamily,
			injectCSS: testState.injectCSS,
		}),
	}
})

describe("community theme loader", () => {
	beforeEach(() => {
		testState.directories = [
			{
				name: "quiet-theme",
				path: "/vault/.cortex/themes/quiet-theme",
				isDir: true,
			},
		]
		testState.files.clear()
		testState.listDir.mockClear()
		testState.listDir.mockImplementation(async () => testState.directories)
		testState.readFile.mockClear()
		testState.readFile.mockImplementation(async (path: string) => {
			const content = testState.files.get(path)
			if (content === undefined) throw new Error(`Missing file: ${path}`)
			return content
		})
		testState.registerCommunityFamily.mockClear()
		testState.injectCSS.mockClear()
	})

	it("registers community themes without reading CSS files during discovery", async () => {
		const themesDir = "/vault/.cortex/themes"
		const darkCss =
			'@font-face { font-family: "Quiet"; src: url("./quiet.woff2"); } body { color: red; }'
		const lightCss = "@media (prefers-contrast: more) { * { outline: 1px solid currentColor; } }"
		testState.files.set(
			`${themesDir}/quiet-theme/manifest.json`,
			JSON.stringify({
				id: "quiet-theme",
				name: "quiet-theme",
				displayName: "Quiet Theme",
				author: "Cortex",
				version: "1.0.0",
				colorschemes: {
					dark: "dark.css",
					light: "light.css",
				},
			}),
		)
		testState.files.set(`${themesDir}/quiet-theme/dark.css`, darkCss)
		testState.files.set(`${themesDir}/quiet-theme/light.css`, lightCss)

		await loadCommunityThemes(themesDir)

		expect(testState.readFile).toHaveBeenCalledTimes(1)
		expect(testState.readFile).toHaveBeenCalledWith(`${themesDir}/quiet-theme/manifest.json`)
		expect(testState.registerCommunityFamily).toHaveBeenCalledWith({
			name: "quiet-theme",
			displayName: "Quiet Theme",
			darkTheme: "quiet-theme-dark",
			lightTheme: "quiet-theme-light",
		})
		expect(testState.injectCSS).not.toHaveBeenCalled()
		expect(testState.readFile).not.toHaveBeenCalledWith(`${themesDir}/quiet-theme/dark.css`)
		expect(testState.readFile).not.toHaveBeenCalledWith(`${themesDir}/quiet-theme/light.css`)
	})

	it("loads and injects only the requested community theme CSS once", async () => {
		const themesDir = "/vault/.cortex/themes"
		const darkCss =
			'@font-face { font-family: "Quiet"; src: url("./quiet.woff2"); } body { color: red; }'
		const lightCss = "@media (prefers-contrast: more) { * { outline: 1px solid currentColor; } }"
		testState.files.set(
			`${themesDir}/quiet-theme/manifest.json`,
			JSON.stringify({
				id: "quiet-theme",
				name: "quiet-theme",
				displayName: "Quiet Theme",
				author: "Cortex",
				version: "1.0.0",
				colorschemes: {
					dark: "dark.css",
					light: "light.css",
				},
			}),
		)
		testState.files.set(`${themesDir}/quiet-theme/dark.css`, darkCss)
		testState.files.set(`${themesDir}/quiet-theme/light.css`, lightCss)

		await loadCommunityThemes(themesDir)
		testState.readFile.mockClear()

		await ensureCommunityThemeCssLoaded("quiet-theme-dark")
		await ensureCommunityThemeCssLoaded("quiet-theme-dark")
		await ensureCommunityThemeCssLoaded("paper")

		expect(testState.readFile).toHaveBeenCalledTimes(1)
		expect(testState.readFile).toHaveBeenCalledWith(`${themesDir}/quiet-theme/dark.css`)
		expect(testState.readFile).not.toHaveBeenCalledWith(`${themesDir}/quiet-theme/light.css`)
		expect(testState.injectCSS).toHaveBeenCalledTimes(1)
		expect(testState.injectCSS).toHaveBeenCalledWith(darkCss, "quiet-theme-dark")
	})

	it("keeps discovery cheap when many community themes are installed", async () => {
		const themesDir = "/vault/.cortex/themes"
		const themeCount = 25

		testState.directories = Array.from({ length: themeCount }, (_, index) => {
			const name = `theme-${index}`
			return {
				name,
				path: `${themesDir}/${name}`,
				isDir: true,
			}
		})

		for (let index = 0; index < themeCount; index++) {
			const name = `theme-${index}`
			testState.files.set(
				`${themesDir}/${name}/manifest.json`,
				JSON.stringify({
					id: name,
					name,
					displayName: `Theme ${index}`,
					author: "Cortex",
					version: "1.0.0",
					colorschemes: {
						dark: "dark.css",
						light: "light.css",
					},
				}),
			)
			testState.files.set(`${themesDir}/${name}/dark.css`, `dark css ${index}`)
			testState.files.set(`${themesDir}/${name}/light.css`, `light css ${index}`)
		}

		await loadCommunityThemes(themesDir)

		const discoveryReadPaths = testState.readFile.mock.calls.map(([path]) => path)
		expect(testState.registerCommunityFamily).toHaveBeenCalledTimes(themeCount)
		expect(testState.readFile).toHaveBeenCalledTimes(themeCount)
		expect(discoveryReadPaths.every((path) => path.endsWith("/manifest.json"))).toBe(true)
		expect(discoveryReadPaths.filter((path) => path.endsWith(".css"))).toHaveLength(0)
		expect(testState.injectCSS).not.toHaveBeenCalled()

		testState.readFile.mockClear()
		testState.injectCSS.mockClear()

		await ensureCommunityThemeCssLoaded("theme-7-dark")
		await ensureCommunityThemeCssLoaded("theme-7-dark")
		await ensureCommunityThemeCssLoaded("theme-7-light")

		expect(testState.readFile).toHaveBeenCalledTimes(2)
		expect(testState.readFile).toHaveBeenNthCalledWith(1, `${themesDir}/theme-7/dark.css`)
		expect(testState.readFile).toHaveBeenNthCalledWith(2, `${themesDir}/theme-7/light.css`)
		expect(testState.injectCSS).toHaveBeenCalledTimes(2)
		expect(testState.injectCSS).toHaveBeenNthCalledWith(1, "dark css 7", "theme-7-dark")
		expect(testState.injectCSS).toHaveBeenNthCalledWith(2, "light css 7", "theme-7-light")
	})
})
