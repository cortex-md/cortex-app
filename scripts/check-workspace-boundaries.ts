import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

interface WorkspacePackage {
	name: string
	directory: string
	manifest: {
		dependencies?: Record<string, string>
		devDependencies?: Record<string, string>
		peerDependencies?: Record<string, string>
	}
}

const workspaceRoots = ["apps", "packages", "plugins"]
const allowedDependencies: Record<string, readonly string[]> = {
	"@cortex/commands": [],
	"@cortex/platform": [],
	"@cortex/properties": [],
	"@cortex/renderer": [],
	"@cortex/templates": [],
	"@cortex/theme": [],
	"@cortex/theme-mobile": [],
	"@cortex/settings": ["@cortex/platform"],
	"@cortex/core": [
		"@cortex/platform",
		"@cortex/properties",
		"@cortex/settings",
		"@cortex/templates",
	],
	"@cortex/editor": ["@cortex/commands", "@cortex/properties", "@cortex/renderer"],
	"@cortex/ipc": ["@cortex/platform"],
	"@cortex.md/api": [],
	"@cortex/plugin-host-core": [
		"@cortex/commands",
		"@cortex/platform",
		"@cortex/properties",
		"@cortex/renderer",
		"@cortex.md/api",
	],
	"@cortex/plugin-host-web": [
		"@cortex/platform",
		"@cortex/plugin-host-core",
		"@cortex/renderer",
		"@cortex/ui",
		"@cortex.md/api",
	],
	"@cortex/ui": [],
	"@cortex/search": ["@cortex/platform", "@cortex/properties"],
	"@cortex/hotkeys": ["@cortex/platform"],
	"@cortex/marketplace": ["@cortex/platform", "@cortex/plugin-host-core", "@cortex/theme"],
	"@cortex/plugin-github-emoji": ["@cortex.md/api"],
	"@cortex/web": ["@cortex/ui"],
	"@cortex/mobile": [
		"@cortex.md/api",
		"@cortex/commands",
		"@cortex/core",
		"@cortex/editor",
		"@cortex/platform",
		"@cortex/plugin-host-core",
		"@cortex/properties",
		"@cortex/theme-mobile",
	],
}

const forbiddenDependencies: Record<string, readonly string[]> = {
	"@cortex/desktop": ["@cortex/theme-mobile"],
	"@cortex/marketplace": ["@cortex/theme-mobile"],
	"@cortex/theme": ["@cortex/theme-mobile"],
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
	/^@tauri-apps\//,
	/^@cortex\/ipc($|\/)/,
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
		forbiddenImports: [...portableForbiddenImports, /^@cortex\/theme-mobile($|\/)/],
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/theme-mobile": {
		forbiddenImports: portableForbiddenImports,
		forbiddenIdentifiers: portableForbiddenIdentifiers,
	},
	"@cortex/plugin-host-core": {
		forbiddenImports: portableForbiddenImports,
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
		pattern: /\bregisterCommand\s*\(/,
		message: "must register app/plugin commands only through the central command owners",
		allowedPaths: [
			"packages/commands/src/index.ts",
			"packages/plugin-host-core/src/apis/CommandsAPI.ts",
			"apps/desktop/src/hooks/useAppCommands.ts",
			"apps/mobile/src/features/editor/mobile-editor-commands.ts",
		],
	},
	{
		pattern: /\bcommand\.execute\s*\(/,
		message: "must execute commands through commandRegistry.execute or executeCommand",
		allowedPaths: [
			"packages/commands/src/CommandRegistry.ts",
			"packages/plugin-host-core/src/apis/CommandsAPI.ts",
		],
	},
]

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T
}

function collectWorkspacePackages(): WorkspacePackage[] {
	const packages: WorkspacePackage[] = []
	for (const root of workspaceRoots) {
		for (const entry of readdirSync(root)) {
			const directory = join(root, entry)
			const manifestPath = join(directory, "package.json")
			if (!existsSync(manifestPath)) continue
			const manifest = readJson<WorkspacePackage["manifest"] & { name?: string }>(manifestPath)
			if (manifest.name) packages.push({ name: manifest.name, directory, manifest })
		}
	}
	return packages
}

function collectSourceFiles(directory: string): string[] {
	const files: string[] = []
	const visit = (currentDirectory: string) => {
		for (const entry of readdirSync(currentDirectory)) {
			if (entry === "dist" || entry === "node_modules" || entry === "target") continue
			const path = join(currentDirectory, entry)
			const stats = statSync(path)
			if (stats.isDirectory()) visit(path)
			else if (/\.[cm]?[jt]sx?$/.test(entry)) files.push(path)
		}
	}
	const sourceDirectory = join(directory, "src")
	if (existsSync(sourceDirectory)) visit(sourceDirectory)
	return files
}

function collectModuleSpecifiers(path: string): string[] {
	const source = readFileSync(path, "utf8")
	const sourceFile = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	)
	const specifiers: string[] = []
	const visit = (node: ts.Node) => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			specifiers.push(node.moduleSpecifier.text)
		}
		if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments.length === 1 &&
			ts.isStringLiteral(node.arguments[0])
		) {
			specifiers.push(node.arguments[0].text)
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return specifiers
}

function collectIdentifiers(path: string): Set<string> {
	const source = readFileSync(path, "utf8")
	const sourceFile = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	)
	const identifiers = new Set<string>()
	const visit = (node: ts.Node) => {
		if (ts.isIdentifier(node)) identifiers.add(node.text)
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return identifiers
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
	for (const forbiddenDependency of forbiddenDependencies[workspacePackage.name] ?? []) {
		if (declared[forbiddenDependency] || imports.has(forbiddenDependency)) {
			errors.push(
				`${workspacePackage.name} must not depend on or import ${forbiddenDependency}`,
			)
		}
	}

	const allowed = allowedDependencies[workspacePackage.name]
	if (allowed) {
		for (const importedWorkspace of imports) {
			if (!allowed.includes(importedWorkspace)) {
				errors.push(
					`${workspacePackage.name} violates its layer by importing ${importedWorkspace}`,
				)
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
