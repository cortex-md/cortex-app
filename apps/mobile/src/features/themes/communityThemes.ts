import { useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import {
	generateCSSVariables,
	getThemeManager,
	inkTheme,
	paperTheme,
	parseCommunityThemeManifest,
	type Theme,
	type ThemeFamily,
	type ThemeTokens,
} from "@cortex/theme"
import { useSyncExternalStore } from "react"

import { normalizeColor } from "@/features/themes/cssColor"

interface TokenLeaf {
	path: readonly string[]
	variables: readonly string[]
}

interface CommunityThemeVariant {
	theme: Theme
	editorVariables: Record<string, string>
}

interface LoadedCommunityTheme {
	family: ThemeFamily
	dark: CommunityThemeVariant
	light: CommunityThemeVariant
}

const SENTINEL = "__cortex_token_probe_"
const DEFAULT_FAMILY = "default"
const tokenLeafCache = new Map<string, readonly TokenLeaf[]>()
const editorVariablesByTheme = new Map<string, Record<string, string>>()
const listeners = new Set<() => void>()
let families: readonly ThemeFamily[] = getThemeManager().getThemeFamilies()
let generation = 0

export function getCommunityThemesDir(): string | null {
	const vaultPath = useVaultStore.getState().vault?.path
	return vaultPath ? `${vaultPath}/.cortex/themes` : null
}

function cloneTokens(tokens: ThemeTokens): ThemeTokens {
	return JSON.parse(JSON.stringify(tokens)) as ThemeTokens
}

function collectLeafPaths(node: unknown, path: string[], paths: string[][]): void {
	if (typeof node === "string") {
		paths.push(path)
		return
	}
	if (!node || typeof node !== "object") return
	for (const [key, value] of Object.entries(node)) collectLeafPaths(value, [...path, key], paths)
}

function readLeaf(tokens: ThemeTokens, path: readonly string[]): unknown {
	let node: unknown = tokens
	for (const key of path) {
		if (!node || typeof node !== "object") return undefined
		node = (node as Record<string, unknown>)[key]
	}
	return node
}

function writeLeaf(tokens: ThemeTokens, path: readonly string[], value: string): void {
	let node = tokens as unknown as Record<string, unknown>
	for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>
	const last = path[path.length - 1]
	if (last !== undefined) node[last] = value
}

function getTokenLeaves(base: Theme): readonly TokenLeaf[] {
	const cached = tokenLeafCache.get(base.name)
	if (cached) return cached
	const paths: string[][] = []
	collectLeafPaths(base.tokens, [], paths)
	const probe = cloneTokens(base.tokens)
	paths.forEach((path, index) => writeLeaf(probe, path, `${SENTINEL}${index}`))
	const variablesByLeaf = paths.map((): string[] => [])
	for (const [name, value] of Object.entries(generateCSSVariables({ ...base, tokens: probe }))) {
		if (!value.startsWith(SENTINEL)) continue
		variablesByLeaf[Number(value.slice(SENTINEL.length))]?.push(name)
	}
	const leaves = paths.flatMap((path, index) => {
		const variables = variablesByLeaf[index] ?? []
		const baseValue = readLeaf(base.tokens, path)
		return variables.length > 0 && typeof baseValue === "string" && normalizeColor(baseValue)
			? [{ path, variables }]
			: []
	})
	tokenLeafCache.set(base.name, leaves)
	return leaves
}

function parseDeclarations(css: string): Map<string, string> {
	const declarations = new Map<string, string>()
	const source = css.replace(/\/\*[\s\S]*?\*\//g, "")
	for (const match of source.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
		const [, name, value] = match
		if (name && value) declarations.set(name, value.replace(/!important/i, "").trim())
	}
	return declarations
}

function substituteReferences(
	value: string,
	lookup: (name: string, seen: ReadonlySet<string>) => string | undefined,
	seen: ReadonlySet<string>,
): string | undefined {
	let result = ""
	let index = 0
	while (index < value.length) {
		const start = value.indexOf("var(", index)
		if (start === -1) {
			result += value.slice(index)
			break
		}
		result += value.slice(index, start)
		let depth = 0
		let comma = -1
		let end = -1
		for (let cursor = start + 3; cursor < value.length; cursor++) {
			const char = value[cursor]
			if (char === "(") depth++
			else if (char === "," && depth === 1 && comma === -1) comma = cursor
			else if (char === ")" && --depth === 0) {
				end = cursor
				break
			}
		}
		if (end === -1) return undefined
		const name = value.slice(start + 4, comma === -1 ? end : comma).trim()
		const fallback = comma === -1 ? undefined : value.slice(comma + 1, end).trim()
		const resolved =
			lookup(name, seen) ??
			(fallback === undefined ? undefined : substituteReferences(fallback, lookup, seen))
		if (resolved === undefined) return undefined
		result += resolved
		index = end + 1
	}
	return result.trim()
}

function resolveColorVariables(
	declarations: Map<string, string>,
	baseVariables: Record<string, string>,
): Map<string, string> {
	const cache = new Map<string, string | undefined>()
	const lookup = (name: string, seen: ReadonlySet<string>): string | undefined => {
		if (seen.has(name)) return undefined
		if (cache.has(name)) return cache.get(name)
		const declared = declarations.get(name)
		const resolved =
			declared === undefined
				? baseVariables[name]
				: substituteReferences(declared, lookup, new Set([...seen, name]))
		cache.set(name, resolved)
		return resolved
	}
	const colors = new Map<string, string>()
	for (const name of declarations.keys()) {
		const value = lookup(name, new Set())
		const color = value === undefined ? null : normalizeColor(value)
		if (color) colors.set(name, color)
	}
	return colors
}

function buildVariant(
	name: string,
	displayName: string,
	base: Theme,
	css: string,
): CommunityThemeVariant {
	const baseVariables = generateCSSVariables(base)
	const colors = resolveColorVariables(parseDeclarations(css), baseVariables)
	const tokens = cloneTokens(base.tokens)
	for (const leaf of getTokenLeaves(base)) {
		const variable = leaf.variables.find((candidate) => colors.has(candidate))
		const color = variable ? colors.get(variable) : undefined
		if (color) writeLeaf(tokens, leaf.path, color)
	}
	const editorVariables = Object.fromEntries(
		[...colors].filter(([variable]) => variable in baseVariables),
	)
	return { theme: { name, displayName, isDark: base.isDark, tokens }, editorVariables }
}

async function readCssFile(path: string): Promise<string> {
	try {
		return await getPlatform().fs.readFile(path)
	} catch {
		return ""
	}
}

async function readCommunityTheme(
	themesDir: string,
	directory: string,
): Promise<LoadedCommunityTheme | null> {
	const root = `${themesDir}/${directory}`
	let manifest: ReturnType<typeof parseCommunityThemeManifest>
	try {
		manifest = parseCommunityThemeManifest(await getPlatform().fs.readFile(`${root}/manifest.json`))
	} catch {
		return null
	}
	if (manifest.name === DEFAULT_FAMILY) return null
	const family: ThemeFamily = {
		name: manifest.name,
		displayName: manifest.displayName,
		darkTheme: `${manifest.name}-dark`,
		lightTheme: `${manifest.name}-light`,
	}
	const [darkCss, lightCss] = await Promise.all([
		readCssFile(`${root}/${manifest.colorschemes.dark}`),
		readCssFile(`${root}/${manifest.colorschemes.light}`),
	])
	return {
		family,
		dark: buildVariant(family.darkTheme, `${family.displayName} Dark`, inkTheme, darkCss),
		light: buildVariant(family.lightTheme, `${family.displayName} Light`, paperTheme, lightCss),
	}
}

async function readCommunityThemes(themesDir: string | null): Promise<LoadedCommunityTheme[]> {
	if (!themesDir) return []
	let entries: Awaited<ReturnType<ReturnType<typeof getPlatform>["fs"]["listDir"]>>
	try {
		entries = await getPlatform().fs.listDir(themesDir)
	} catch {
		return []
	}
	const themes = await Promise.all(
		entries
			.filter((entry) => entry.isDir && !entry.name.startsWith("."))
			.map((entry) => readCommunityTheme(themesDir, entry.name)),
	)
	return themes.filter((theme): theme is LoadedCommunityTheme => theme !== null)
}

function publish(): void {
	families = getThemeManager().getThemeFamilies()
	for (const listener of listeners) listener()
}

function registerCommunityThemes(themes: readonly LoadedCommunityTheme[]): void {
	const themeManager = getThemeManager()
	const names = new Set(themes.map((theme) => theme.family.name))
	for (const family of themeManager.getThemeFamilies()) {
		if (family.name !== DEFAULT_FAMILY && !names.has(family.name)) {
			themeManager.unregisterTheme(family.name)
		}
	}
	editorVariablesByTheme.clear()
	for (const { family, dark, light } of themes) {
		themeManager.registerCommunityFamily(family)
		for (const variant of [dark, light]) {
			themeManager.registerTheme(variant.theme)
			editorVariablesByTheme.set(variant.theme.name, variant.editorVariables)
		}
	}
	publish()
}

export async function reloadCommunityThemes(themesDir = getCommunityThemesDir()): Promise<void> {
	const current = ++generation
	const themes = await readCommunityThemes(themesDir)
	if (current === generation) registerCommunityThemes(themes)
}

export function unloadCommunityThemes(): void {
	generation++
	registerCommunityThemes([])
}

export function getCommunityThemeEditorVariables(themeName: string): Record<string, string> {
	return editorVariablesByTheme.get(themeName) ?? {}
}

export function subscribeCommunityThemes(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getThemeFamilies(): readonly ThemeFamily[] {
	return families
}

export function useThemeFamilies(): readonly ThemeFamily[] {
	return useSyncExternalStore(subscribeCommunityThemes, getThemeFamilies, getThemeFamilies)
}
