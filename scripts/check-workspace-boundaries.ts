import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

interface WorkspacePackage {
	name: string
	directory: string
	manifest: {
		dependencies?: Record<string, string>
		devDependencies?: Record<string, string>
		peerDependencies?: Record<string, string>
	}
}

const workspaceRoots = ["apps", "packages"]
const bundledPluginsDirectory = "plugins"
const allowedDependencies: Record<string, readonly string[]> = {
	"@cortex/commands": ["@cortex/platform"],
	"@cortex/comments": [],
	"@cortex/platform": [],
	"@cortex/properties": [],
	"@cortex/renderer": ["@cortex/properties"],
	"@cortex/tasks": [],
	"@cortex/theme": [],
	"@cortex/settings": ["@cortex/platform"],
	"@cortex/sync-api": ["@cortex/platform"],
	"@cortex/collab": ["@cortex/platform"],
	"@cortex/core": [
		"@cortex/collab",
		"@cortex/commands",
		"@cortex/comments",
		"@cortex/platform",
		"@cortex/properties",
		"@cortex/search",
		"@cortex/settings",
		"@cortex/sync-api",
		"@cortex/tasks",
	],
	"@cortex/editor": [
		"@cortex/collab",
		"@cortex/commands",
		"@cortex/comments",
		"@cortex/platform",
		"@cortex/properties",
		"@cortex/renderer",
		"@cortex/tasks",
	],
	"@cortex.md/api": [],
	"@cortex/plugin-host-core": [
		"@cortex/commands",
		"@cortex/platform",
		"@cortex/properties",
		"@cortex/renderer",
		"@cortex.md/api",
	],
	"@cortex/ui": [],
	"@cortex/search": ["@cortex/platform", "@cortex/properties"],
	"@cortex/import-export": ["@cortex/platform", "@cortex/renderer"],
	"@cortex/marketplace": ["@cortex/platform", "@cortex/theme"],
	"@cortex/plugins": ["@cortex.md/api"],
	"@cortex/web": ["@cortex/marketplace", "@cortex/sync-api", "@cortex/ui"],
	"@cortex/mobile": [
		"@cortex.md/api",
		"@cortex/collab",
		"@cortex/commands",
		"@cortex/core",
		"@cortex/editor",
		"@cortex/import-export",
		"@cortex/marketplace",
		"@cortex/platform",
		"@cortex/plugin-host-core",
		"@cortex/plugins",
		"@cortex/properties",
		"@cortex/renderer",
		"@cortex/search",
		"@cortex/settings",
		"@cortex/sync-api",
		"@cortex/sync-engine",
		"@cortex/tasks",
		"@cortex/theme",
	],
}

interface SourceBoundaryRule {
	forbiddenImports: readonly RegExp[]
	forbiddenIdentifiers: readonly string[]
}

interface CommandSurfaceRule {
	pattern: RegExp
	message: string
	allowedPaths: readonly string[]
}

const portableForbiddenImports = [
	/^react($|\/)/,
	/^react-dom($|\/)/,
	/^@cortex\/ui($|\/)/,
	/^@cortex\/editor($|\/)/,
	/^@codemirror\//,
	/^electron($|\/)/,
	/^node:/,
	/^(fs|path|os|child_process|worker_threads)$/,
	/^(lucide-react|cmdk|sonner|vaul|radix-ui)($|\/)/,
]

const portableForbiddenIdentifiers = [
	"window",
	"document",
	"HTMLElement",
	"HTMLDivElement",
	"HTMLSpanElement",
	"HTMLInputElement",
	"HTMLTextAreaElement",
	"HTMLButtonElement",
	"Document",
	"localStorage",
	"navigator",
	"ResizeObserver",
]

const sourceBoundaryRules: Record<string, SourceBoundaryRule> = {
	"@cortex.md/api": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/renderer": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/theme": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/plugin-host-core": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/import-export": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/plugins": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/platform": {
		forbiddenImports: [...portableForbiddenImports, /^(expo|expo-[\w-]+|react-native[\w-]*)($|\/)/],
		forbiddenIdentifiers: portableForbiddenIdentifiers.filter(
			(identifier) => identifier !== "window",
		),
	},
	"@cortex/tasks": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/comments": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/collab": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/sync-api": {
		forbiddenImports: [...portableForbiddenImports, /^argon2($|\/)/, /^@cortex\/sync-engine($|\/)/],
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
}

const commandSurfaceRules: readonly CommandSurfaceRule[] = [
	{
		pattern: /\b(addDynamicBinding|removeDynamicBinding|dynamicBindingIds|DEFAULT_HOTKEYS)\b/,
		message: "must not use legacy or parallel hotkey catalogs",
		allowedPaths: [],
	},
	{
		pattern: /\b(registerCommands?|registerMany)\s*\(/,
		message: "must register app/plugin commands only through the central command owners",
		allowedPaths: [
			"packages/commands/src/index.ts",
			"packages/commands/src/CommandRegistry.ts",
			"packages/plugin-host-core/src/pluginContributions.ts",
			"apps/desktop/src/bootstrap/appCommands.ts",
			"apps/mobile/src/features/editor/editorCommands.ts",
			"apps/mobile/src/bootstrap/appCommands.ts",
			"apps/mobile/src/features/workspace/workspaceChannel.ts",
		],
	},
	{
		pattern: /\bcommand\.execute\s*\(/,
		message: "must execute commands through commandRegistry.execute or executeCommand",
		allowedPaths: ["packages/commands/src/CommandRegistry.ts"],
	},
]

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T
}

function collectWorkspacePackages(): WorkspacePackage[] {
	const packages: WorkspacePackage[] = []
	const directories = [
		...workspaceRoots.flatMap((root) => readdirSync(root).map((entry) => join(root, entry))),
		bundledPluginsDirectory,
	]
	for (const directory of directories) {
		const manifestPath = join(directory, "package.json")
		if (!existsSync(manifestPath)) continue
		const manifest = readJson<WorkspacePackage["manifest"] & { name?: string }>(manifestPath)
		if (manifest.name) packages.push({ name: manifest.name, directory, manifest })
	}
	return packages
}

function collectSourceFiles(directory: string): string[] {
	const files: string[] = []
	const visit = (currentDirectory: string) => {
		for (const entry of readdirSync(currentDirectory)) {
			if (entry === "dist" || entry === "node_modules" || entry === "target" || entry === "out") {
				continue
			}
			const path = join(currentDirectory, entry)
			const stats = statSync(path)
			if (stats.isDirectory()) visit(path)
			else if (/\.[cm]?[jt]sx?$/.test(entry)) files.push(path)
		}
	}
	if (directory === bundledPluginsDirectory) {
		visit(directory)
		return files
	}
	for (const sourceName of ["src", "electron"]) {
		const sourceDirectory = join(directory, sourceName)
		if (existsSync(sourceDirectory)) visit(sourceDirectory)
	}
	return files
}

const MODULE_SPECIFIER_PATTERN =
	/\b(?:import|export)\s+(?:type\s+)?(?:[\w$*{},\s]+\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g

function readCode(path: string): string {
	return readFileSync(path, "utf8")
		.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1")
		.replace(/`(?:\\.|[^`\\])*`/g, "``")
}

function collectModuleSpecifiers(path: string): string[] {
	return Array.from(
		readCode(path).matchAll(MODULE_SPECIFIER_PATTERN),
		(match) => match[1] ?? match[2] ?? "",
	)
}

function collectIdentifiers(path: string): Set<string> {
	const code = readCode(path).replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, "")
	return new Set(code.match(/[A-Za-z_$][\w$]*/g) ?? [])
}

function isTestSource(path: string): boolean {
	return /\b(__tests__|test-utils)\b|\.test\.[cm]?[jt]sx?$/.test(path)
}

function resolveWorkspacePackage(
	specifier: string,
	workspaceNames: readonly string[],
): string | undefined {
	return workspaceNames.find((name) => specifier === name || specifier.startsWith(`${name}/`))
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
	const cycles: string[][] = []
	const visiting = new Set<string>()
	const visited = new Set<string>()
	const path: string[] = []
	const visit = (name: string) => {
		if (visiting.has(name)) {
			const start = path.indexOf(name)
			cycles.push([...path.slice(start), name])
			return
		}
		if (visited.has(name)) return
		visiting.add(name)
		path.push(name)
		for (const dependency of graph.get(name) ?? []) visit(dependency)
		path.pop()
		visiting.delete(name)
		visited.add(name)
	}
	for (const name of graph.keys()) visit(name)
	return cycles
}

const workspacePackages = collectWorkspacePackages()
const workspaceNames = workspacePackages.map((workspacePackage) => workspacePackage.name)
const graph = new Map<string, Set<string>>()
const errors: string[] = []

for (const workspacePackage of workspacePackages) {
	const imports = new Set<string>()
	const sourceFiles = collectSourceFiles(workspacePackage.directory)
	for (const path of sourceFiles) {
		for (const specifier of collectModuleSpecifiers(path)) {
			const importedWorkspace = resolveWorkspacePackage(specifier, workspaceNames)
			if (importedWorkspace && importedWorkspace !== workspacePackage.name) {
				imports.add(importedWorkspace)
			}
		}
	}
	const sourceBoundaryRule = sourceBoundaryRules[workspacePackage.name]
	if (sourceBoundaryRule) {
		for (const path of sourceFiles) {
			for (const specifier of collectModuleSpecifiers(path)) {
				if (
					sourceBoundaryRule.forbiddenImports.some((forbiddenImport) =>
						forbiddenImport.test(specifier),
					)
				) {
					errors.push(
						`${workspacePackage.name} portable source must not import ${specifier} in ${path}`,
					)
				}
			}
			const identifiers = collectIdentifiers(path)
			for (const identifier of sourceBoundaryRule.forbiddenIdentifiers) {
				if (identifiers.has(identifier)) {
					errors.push(
						`${workspacePackage.name} portable source must not reference ${identifier} in ${path}`,
					)
				}
			}
		}
	}
	for (const path of sourceFiles) {
		if (isTestSource(path)) continue
		const source = readFileSync(path, "utf8")
		for (const rule of commandSurfaceRules) {
			if (!rule.pattern.test(source) || rule.allowedPaths.includes(path)) continue
			errors.push(`${path} ${rule.message}`)
		}
	}
	graph.set(workspacePackage.name, imports)
	const declared = {
		...workspacePackage.manifest.dependencies,
		...workspacePackage.manifest.devDependencies,
		...workspacePackage.manifest.peerDependencies,
	}
	const declaredWorkspaceDependencies = Object.entries(declared)
		.filter(([, version]) => version.startsWith("workspace:"))
		.map(([name]) => name)

	for (const importedWorkspace of imports) {
		if (!declared[importedWorkspace]) {
			errors.push(`${workspacePackage.name} imports undeclared workspace ${importedWorkspace}`)
		}
	}
	for (const dependency of declaredWorkspaceDependencies) {
		if (!imports.has(dependency)) {
			errors.push(`${workspacePackage.name} declares unused workspace ${dependency}`)
		}
	}
	const allowed = allowedDependencies[workspacePackage.name]
	if (allowed) {
		for (const importedWorkspace of imports) {
			if (!allowed.includes(importedWorkspace)) {
				errors.push(`${workspacePackage.name} violates its layer by importing ${importedWorkspace}`)
			}
		}
	}
}

for (const cycle of findCycles(graph)) errors.push(`workspace cycle: ${cycle.join(" -> ")}`)

if (errors.length > 0) {
	for (const error of errors) console.error(error)
	process.exit(1)
}

console.log(`Workspace boundaries valid for ${workspacePackages.length} packages`)
