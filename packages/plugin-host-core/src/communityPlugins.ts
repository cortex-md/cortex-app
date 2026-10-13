import type { FileEntry, FileSystem } from "@cortex/platform"
import { definePlugin, PLUGIN_PERMISSIONS, type PluginDefinition } from "@cortex.md/api"

export type CommunityPluginFs = Pick<FileSystem, "readFile">

export interface CommunityPluginFiles {
	manifest: { id: string; main: string }
	code: string
	styles: string | null
}

interface CommunityPluginLocation {
	pluginId: string
	dirPath: string
}

export type CommunityPluginFailure = CommunityPluginLocation & { error: string }

export type CommunityPluginFilesResult =
	| (CommunityPluginLocation & { files: CommunityPluginFiles })
	| CommunityPluginFailure

export type CommunityPluginDiscovery =
	| (CommunityPluginLocation & { definition: PluginDefinition; styles: string | null })
	| CommunityPluginFailure

interface CommunityManifestFile {
	id?: unknown
	main?: unknown
}

const codeMirrorImportPattern = /["']@codemirror\//
const esmPattern = /\bexport\s+(default|\{|\*|class|const|function|let|var)|\bimport\s+/

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function reportPluginOperationError(operation: string, pluginId: string, error: unknown) {
	console.error("[Plugin operation failed]", {
		operation,
		pluginId,
		error: getErrorMessage(error),
	})
}

export function getCommunityPluginsDir(vaultPath: string | null): string | null {
	return vaultPath ? `${vaultPath}/.cortex/plugins` : null
}

export function isPluginDirInside(pluginDir: string, pluginsDir: string): boolean {
	const normalizedPluginDir = pluginDir.replaceAll("\\", "/").replace(/\/+$/g, "")
	const normalizedPluginsDir = pluginsDir.replaceAll("\\", "/").replace(/\/+$/g, "")
	return (
		normalizedPluginDir === normalizedPluginsDir ||
		normalizedPluginDir.startsWith(`${normalizedPluginsDir}/`)
	)
}

function resolvePluginMainPath(pluginDir: string, mainPath: string): string | null {
	const normalized = mainPath.replaceAll("\\", "/").trim()
	const segments = normalized.split("/").filter((segment) => segment && segment !== ".")
	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[a-zA-Z]:/.test(normalized) ||
		segments.length === 0 ||
		segments.some((segment) => segment === "..")
	) {
		return null
	}
	return `${pluginDir}/${segments.join("/")}`
}

async function readOptionalFile(fs: CommunityPluginFs, path: string): Promise<string | null> {
	try {
		return await fs.readFile(path)
	} catch {
		return null
	}
}

export async function readCommunityPluginFiles(
	dir: FileEntry,
	fs: CommunityPluginFs,
): Promise<CommunityPluginFilesResult> {
	let pluginId = dir.name
	try {
		const manifest = JSON.parse(
			await fs.readFile(`${dir.path}/manifest.json`),
		) as CommunityManifestFile
		if (typeof manifest.id !== "string" || !manifest.id) {
			return { pluginId, dirPath: dir.path, error: "manifest.json is missing id" }
		}
		pluginId = manifest.id
		if (typeof manifest.main !== "string" || !manifest.main) {
			return { pluginId, dirPath: dir.path, error: "manifest.json is missing main" }
		}
		const mainPath = resolvePluginMainPath(dir.path, manifest.main)
		if (!mainPath) {
			return { pluginId, dirPath: dir.path, error: "manifest.main must be a safe relative path" }
		}
		const [stylesSource, code] = await Promise.all([
			readOptionalFile(fs, `${dir.path}/styles.css`),
			fs.readFile(mainPath),
		])
		return {
			pluginId,
			dirPath: dir.path,
			files: {
				manifest: { id: pluginId, main: manifest.main },
				code,
				styles: await scopeCommunityStyles(stylesSource),
			},
		}
	} catch (error) {
		return { pluginId, dirPath: dir.path, error: getErrorMessage(error) }
	}
}

async function scopeCommunityStyles(source: string | null): Promise<string | null> {
	if (!source?.trim()) return null
	const { scopePluginMarkdownStyles } = await import("./pluginStyles")
	return scopePluginMarkdownStyles(source)
}

export function assertCommunityStyles(styles: string | null, hasMarkdownContributions: boolean) {
	if (styles && !hasMarkdownContributions) {
		throw new Error("styles.css requires markdown contributions")
	}
}

function assertCommunityPluginId(declaredId: string, manifestId: string): void {
	if (declaredId !== manifestId) {
		throw new Error(`Bundle declares plugin "${declaredId}" instead of "${manifestId}"`)
	}
}

export function validatePluginDefinition(definition: PluginDefinition): void {
	const { manifest } = definition
	if (!manifest?.id || !manifest.name || !manifest.version) {
		throw new Error("Plugin manifest requires id, name, and version")
	}
	const knownPermissions = new Set<string>(PLUGIN_PERMISSIONS)
	for (const permission of manifest.permissions ?? []) {
		if (!knownPermissions.has(permission)) {
			throw new Error(`Unknown plugin permission "${permission}"`)
		}
	}
}

export async function evaluateCommunityPlugin(
	code: string,
	options: {
		manifestId: string
		loadExternals(needsEditorExternals: boolean): Promise<Record<string, unknown>>
	},
): Promise<PluginDefinition> {
	const { manifestId } = options
	const externals = await options.loadExternals(codeMirrorImportPattern.test(code))
	let definition: PluginDefinition
	try {
		definition = loadCommonJSDefinition(code, manifestId, externals)
	} catch (commonJSError) {
		if (!esmPattern.test(code)) throw commonJSError
		try {
			const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`
			definition = normalizeDefinition(await importDataModule(moduleUrl))
		} catch (esmError) {
			throw new Error(
				`${getErrorMessage(esmError)}; CommonJS fallback failed: ${getErrorMessage(commonJSError)}`,
			)
		}
	}
	assertCommunityPluginId(definition.manifest.id, manifestId)
	return definition
}

function importDataModule(moduleUrl: string): Promise<unknown> {
	// Built through indirect eval so bundlers (Vite, Metro) leave the data-URL import to the runtime.
	// biome-ignore lint/security/noGlobalEval: required to load community plugin ESM bundles
	const indirectEval = globalThis.eval
	const importModule = indirectEval("(url) => import(url)") as (url: string) => Promise<unknown>
	return importModule(moduleUrl)
}

function loadCommonJSDefinition(
	code: string,
	pluginId: string,
	externals: Record<string, unknown>,
): PluginDefinition {
	const moduleObject: { exports: Record<string, unknown> } = { exports: {} }
	const requireExternal = (id: string): unknown => {
		if (id === "@cortex.md/api") return { definePlugin, PLUGIN_PERMISSIONS }
		const resolved = externals[id]
		if (resolved) return resolved
		throw new Error(`Cannot require "${id}" in plugin "${pluginId}"`)
	}
	// biome-ignore lint/security/noGlobalEval: required to load community plugin CJS bundles
	const indirectEval = globalThis.eval
	const factory = indirectEval(`(function(module, exports, require) {\n${code}\n})`) as (
		moduleObject: { exports: Record<string, unknown> },
		exports: Record<string, unknown>,
		require: (id: string) => unknown,
	) => void
	factory(moduleObject, moduleObject.exports, requireExternal)
	return normalizeDefinition(moduleObject.exports)
}

function normalizeDefinition(moduleExports: unknown): PluginDefinition {
	const exportsRecord = moduleExports as { default?: unknown }
	const definition = (exportsRecord.default ?? moduleExports) as Partial<PluginDefinition> | null
	if (!definition || typeof definition !== "object" || !definition.manifest) {
		throw new Error("Plugin bundle must export a definePlugin(...) object as default")
	}
	const validated = definition as PluginDefinition
	validatePluginDefinition(validated)
	return validated
}
