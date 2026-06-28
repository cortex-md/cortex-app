export type MarkdownSurface = "reading-view" | "export"

export type MarkdownSemanticSurface = MarkdownSurface | "live-preview"

export type MarkdownProcessorPhase = "remark" | "rehype"

export interface MarkdownUnifiedNode {
	type: string
	children?: MarkdownUnifiedNode[]
	[property: string]: unknown
}

export interface MarkdownUnifiedFile {
	data: Record<string, unknown>
	path?: string
	value: unknown
	[property: string]: unknown
}

export type MarkdownUnifiedTransformer = (
	tree: MarkdownUnifiedNode,
	file: MarkdownUnifiedFile,
) => unknown

export type MarkdownUnifiedPlugin = () => MarkdownUnifiedTransformer | undefined

export type MarkdownPortableNode =
	| { type: "text"; value: string }
	| { type: "container"; children: readonly MarkdownPortableNode[] }
	| { type: "span"; className?: string; children: readonly MarkdownPortableNode[] }
	| { type: "link"; href: string; children: readonly MarkdownPortableNode[] }
	| { type: "image"; src: string; alt: string }
	| { type: "code"; value: string; language?: string }

export interface MarkdownNodeSelector {
	type: "text"
}

export interface MarkdownSemanticContext {
	surface: MarkdownSemanticSurface
	node: MarkdownPortableNode
	source: string
}

export interface MarkdownSemanticRegistration {
	id: string
	selector: MarkdownNodeSelector
	priority?: number
	transform: (
		context: MarkdownSemanticContext,
	) => MarkdownPortableNode | readonly MarkdownPortableNode[] | null
}

export type MarkdownInlineReplacement =
	| { type: "text"; content: string | ((match: RegExpExecArray) => string) }
	| { type: "mark"; className: string }

export interface MarkdownInlineRegistration {
	id: string
	pattern: string
	flags?: string
	priority?: number
	replacement: MarkdownInlineReplacement
}

export interface MarkdownPreprocessorContext {
	surface: MarkdownSurface
}

export interface MarkdownPreprocessorRegistration {
	id: string
	surfaces: readonly MarkdownSurface[]
	priority?: number
	preprocess: (markdown: string, context: MarkdownPreprocessorContext) => string | Promise<string>
}

export interface MarkdownProcessorRegistration {
	id: string
	phase: MarkdownProcessorPhase
	surfaces: readonly MarkdownSurface[]
	priority?: number
	processor: MarkdownUnifiedPlugin
}

export interface MarkdownDiagnostic {
	registrationId: string
	namespace: string
	severity: "warning" | "error"
	message: string
	durationMs?: number
}

interface RegistryEntry<T> {
	key: string
	namespace: string
	order: number
	value: T
}

export interface MarkdownTextTransform {
	from: number
	to: number
	nodes: readonly MarkdownPortableNode[]
}

export interface RegisteredMarkdownProcessor {
	namespace: string
	registration: MarkdownProcessorRegistration
}

export interface RegisteredMarkdownPreprocessor {
	namespace: string
	registration: MarkdownPreprocessorRegistration
}

const inlineEntries: RegistryEntry<MarkdownInlineRegistration>[] = []
const semanticEntries: RegistryEntry<MarkdownSemanticRegistration>[] = []
const preprocessorEntries: RegistryEntry<MarkdownPreprocessorRegistration>[] = []
const processorEntries: RegistryEntry<MarkdownProcessorRegistration>[] = []
const activeKeys = new Set<string>()
const listeners = new Set<() => void>()
const diagnosticListeners = new Set<(diagnostic: MarkdownDiagnostic) => void>()
const inlineRegexCache = new WeakMap<MarkdownInlineRegistration, RegExp>()
let nextEntryOrder = 0
let registryVersion = 0

function normalizeNamespace(namespace: string): string {
	const normalized = namespace.trim()
	if (!normalized) throw new Error("Markdown registration namespace is required")
	return normalized
}

function validateRegistrationId(id: string): string {
	const normalized = id.trim()
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized)) {
		throw new Error(`Invalid Markdown registration id: "${id}"`)
	}
	return normalized
}

function validatePriority(priority: number | undefined): void {
	if (priority !== undefined && !Number.isFinite(priority)) {
		throw new Error("Markdown registration priority must be a finite number")
	}
}

function createRegistrationKey(namespace: string, id: string): string {
	return `${normalizeNamespace(namespace)}:${validateRegistrationId(id)}`
}

function notifyRegistryChanged(): void {
	registryVersion++
	for (const listener of listeners) {
		try {
			listener()
		} catch (error) {
			reportMarkdownDiagnostic({
				registrationId: "registry-listener",
				namespace: "core",
				severity: "error",
				message: error instanceof Error ? error.message : String(error),
			})
		}
	}
}

function registerEntry<T>(
	entries: RegistryEntry<T>[],
	namespace: string,
	id: string,
	value: T,
): () => void {
	const key = createRegistrationKey(namespace, id)
	if (activeKeys.has(key)) throw new Error(`Markdown registration "${key}" is already active`)
	const entry = {
		key,
		namespace: normalizeNamespace(namespace),
		order: nextEntryOrder++,
		value,
	}
	activeKeys.add(key)
	entries.push(entry)
	notifyRegistryChanged()
	return () => {
		const index = entries.indexOf(entry)
		if (index < 0) return
		entries.splice(index, 1)
		activeKeys.delete(key)
		notifyRegistryChanged()
	}
}

function sortEntries<T extends { priority?: number }>(
	entries: RegistryEntry<T>[],
): RegistryEntry<T>[] {
	return [...entries].sort(
		(left, right) =>
			(right.value.priority ?? 0) - (left.value.priority ?? 0) || left.order - right.order,
	)
}

export function compileMarkdownInlineRegistration(
	registration: MarkdownInlineRegistration,
): RegExp {
	validateRegistrationId(registration.id)
	validatePriority(registration.priority)
	if (!registration.pattern) throw new Error("Markdown inline pattern is required")
	const flags = registration.flags ?? "gi"
	if (/[^dgimsuvy]/.test(flags) || new Set(flags).size !== flags.length) {
		throw new Error(`Invalid Markdown inline flags: "${flags}"`)
	}
	if (registration.replacement.type === "mark") {
		const classNames = registration.replacement.className.trim().split(/\s+/)
		if (
			classNames.length === 0 ||
			classNames.some((className) => !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(className))
		) {
			throw new Error("Markdown inline mark className contains an invalid CSS class")
		}
	}
	return new RegExp(registration.pattern, flags.includes("g") ? flags : `${flags}g`)
}

function getCompiledInlineRegistration(registration: MarkdownInlineRegistration): RegExp {
	const cached = inlineRegexCache.get(registration)
	if (cached) return cached
	const compiled = compileMarkdownInlineRegistration(registration)
	inlineRegexCache.set(registration, compiled)
	return compiled
}

export function registerMarkdownInline(
	registration: MarkdownInlineRegistration,
	namespace = "core",
): () => void {
	compileMarkdownInlineRegistration(registration)
	return registerEntry(inlineEntries, namespace, registration.id, { ...registration })
}

export function registerMarkdownSemantic(
	registration: MarkdownSemanticRegistration,
	namespace = "core",
): () => void {
	validateRegistrationId(registration.id)
	validatePriority(registration.priority)
	if (registration.selector.type !== "text") {
		throw new Error(`Unsupported Markdown semantic selector: "${registration.selector.type}"`)
	}
	if (typeof registration.transform !== "function") {
		throw new Error("Markdown semantic transform must be a function")
	}
	return registerEntry(semanticEntries, namespace, registration.id, { ...registration })
}

export function registerMarkdownProcessor(
	registration: MarkdownProcessorRegistration,
	namespace = "core",
): () => void {
	validateMarkdownProcessorRegistration(registration)
	return registerEntry(processorEntries, namespace, registration.id, {
		...registration,
		surfaces: [...new Set(registration.surfaces)],
	})
}

export function registerMarkdownPreprocessor(
	registration: MarkdownPreprocessorRegistration,
	namespace = "core",
): () => void {
	validateMarkdownPreprocessorRegistration(registration)
	return registerEntry(preprocessorEntries, namespace, registration.id, {
		...registration,
		surfaces: [...new Set(registration.surfaces)],
	})
}

function validateMarkdownSurfaces(surfaces: readonly MarkdownSurface[], subject: string): void {
	if (
		surfaces.length === 0 ||
		surfaces.some((surface) => surface !== "reading-view" && surface !== "export")
	) {
		throw new Error(
			`Markdown ${subject} support only "reading-view" and "export"; use registerSemantic or editor.registerExtension for Live Preview`,
		)
	}
}

export function validateMarkdownPreprocessorRegistration(
	registration: MarkdownPreprocessorRegistration,
): void {
	validateRegistrationId(registration.id)
	validatePriority(registration.priority)
	validateMarkdownSurfaces(registration.surfaces, "preprocessors")
	if (typeof registration.preprocess !== "function") {
		throw new Error("Markdown preprocessor must be a function")
	}
}

export function validateMarkdownProcessorRegistration(
	registration: MarkdownProcessorRegistration,
): void {
	validateRegistrationId(registration.id)
	validatePriority(registration.priority)
	if (registration.phase !== "remark" && registration.phase !== "rehype") {
		throw new Error(`Unsupported Markdown processor phase: "${registration.phase}"`)
	}
	validateMarkdownSurfaces(registration.surfaces, "processors")
	if (typeof registration.processor !== "function") {
		throw new Error("Markdown processor must be a Unified plugin function")
	}
}

export function getMarkdownInlineRegistrations(): MarkdownInlineRegistration[] {
	return sortEntries(inlineEntries).map((entry) => entry.value)
}

export function getMarkdownSemanticRegistrations(): MarkdownSemanticRegistration[] {
	return sortEntries(semanticEntries).map((entry) => entry.value)
}

export function getMarkdownProcessors(
	surface?: MarkdownSurface,
	phase?: MarkdownProcessorPhase,
): MarkdownProcessorRegistration[] {
	return getMarkdownProcessorEntries(surface, phase).map((entry) => entry.registration)
}

export function getMarkdownPreprocessors(
	surface?: MarkdownSurface,
): MarkdownPreprocessorRegistration[] {
	return getMarkdownPreprocessorEntries(surface).map((entry) => entry.registration)
}

export function getMarkdownPreprocessorEntries(
	surface?: MarkdownSurface,
): RegisteredMarkdownPreprocessor[] {
	return sortEntries(preprocessorEntries).flatMap((entry) => {
		if (surface && !entry.value.surfaces.includes(surface)) return []
		return [{ namespace: entry.namespace, registration: entry.value }]
	})
}

export function getMarkdownProcessorEntries(
	surface?: MarkdownSurface,
	phase?: MarkdownProcessorPhase,
): RegisteredMarkdownProcessor[] {
	return sortEntries(processorEntries).flatMap((entry) => {
		if (surface && !entry.value.surfaces.includes(surface)) return []
		if (phase && entry.value.phase !== phase) return []
		return [{ namespace: entry.namespace, registration: entry.value }]
	})
}

function normalizePortableNodes(
	value: MarkdownPortableNode | readonly MarkdownPortableNode[],
): readonly MarkdownPortableNode[] {
	if (Array.isArray(value)) return value as readonly MarkdownPortableNode[]
	return [value as MarkdownPortableNode]
}

function validatePortableNodes(
	nodes: readonly MarkdownPortableNode[],
	depth = 0,
	counter = { value: 0 },
): void {
	if (depth > 20) throw new Error("Markdown semantic output exceeds the maximum depth")
	for (const node of nodes) {
		counter.value++
		if (counter.value > 1000) throw new Error("Markdown semantic output exceeds 1000 nodes")
		if (node.type === "text" || node.type === "code") {
			if (typeof node.value !== "string") throw new Error(`Invalid ${node.type} node value`)
			continue
		}
		if (node.type === "image") {
			if (typeof node.src !== "string" || typeof node.alt !== "string") {
				throw new Error("Invalid image node")
			}
			continue
		}
		if (node.type === "link") {
			if (typeof node.href !== "string") throw new Error("Invalid link node href")
			validatePortableNodes(node.children, depth + 1, counter)
			continue
		}
		if (node.type === "span") {
			if (
				node.className
					?.trim()
					.split(/\s+/)
					.some((className) => !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(className))
			) {
				throw new Error("Invalid span node className")
			}
			validatePortableNodes(node.children, depth + 1, counter)
			continue
		}
		if (node.type === "container") {
			validatePortableNodes(node.children, depth + 1, counter)
			continue
		}
		throw new Error("Unsupported Markdown portable node")
	}
}

function getInlineTextTransforms(source: string): MarkdownTextTransform[] {
	const candidates: Array<
		MarkdownTextTransform & { priority: number; order: number; namespace: string; id: string }
	> = []
	for (const entry of sortEntries(inlineEntries)) {
		const regex = getCompiledInlineRegistration(entry.value)
		regex.lastIndex = 0
		const registration = entry.value
		let matches = 0
		for (let match = regex.exec(source); match !== null; match = regex.exec(source)) {
			if (match[0].length === 0) {
				regex.lastIndex++
				continue
			}
			matches++
			if (matches > 1000) {
				reportMarkdownDiagnostic({
					registrationId: registration.id,
					namespace: entry.namespace,
					severity: "warning",
					message: "Markdown inline registration exceeded 1000 matches",
				})
				break
			}
			try {
				const replacement = registration.replacement
				const nodes: readonly MarkdownPortableNode[] =
					replacement.type === "mark"
						? [
								{
									type: "span",
									className: replacement.className,
									children: [{ type: "text", value: match[0] }],
								},
							]
						: [
								{
									type: "text",
									value:
										typeof replacement.content === "function"
											? replacement.content(match)
											: replacement.content,
								},
							]
				validatePortableNodes(nodes)
				candidates.push({
					from: match.index,
					to: match.index + match[0].length,
					nodes,
					priority: entry.value.priority ?? 0,
					order: entry.order,
					namespace: entry.namespace,
					id: entry.value.id,
				})
			} catch (error) {
				reportMarkdownDiagnostic({
					registrationId: entry.value.id,
					namespace: entry.namespace,
					severity: "error",
					message: error instanceof Error ? error.message : String(error),
				})
			}
		}
	}

	candidates.sort(
		(left, right) =>
			left.from - right.from ||
			right.priority - left.priority ||
			left.order - right.order ||
			right.to - left.to,
	)
	const accepted: MarkdownTextTransform[] = []
	let occupiedUntil = -1
	for (const candidate of candidates) {
		if (candidate.from < occupiedUntil) continue
		accepted.push({ from: candidate.from, to: candidate.to, nodes: candidate.nodes })
		occupiedUntil = candidate.to
	}
	return accepted
}

interface PortableNodeTransformResult {
	nodes: readonly MarkdownPortableNode[]
	changed: boolean
}

function transformPortableTextNodes(
	nodes: readonly MarkdownPortableNode[],
	transformText: (
		node: Extract<MarkdownPortableNode, { type: "text" }>,
	) => PortableNodeTransformResult,
): PortableNodeTransformResult {
	let changed = false
	const transformedNodes = nodes.flatMap((node): readonly MarkdownPortableNode[] => {
		if (node.type === "text") {
			const transformed = transformText(node)
			if (transformed.changed) changed = true
			return transformed.nodes
		}
		if (node.type === "container" || node.type === "span" || node.type === "link") {
			const transformed = transformPortableTextNodes(node.children, transformText)
			if (!transformed.changed) return [node]
			changed = true
			return [{ ...node, children: transformed.nodes }]
		}
		return [node]
	})
	return { nodes: transformedNodes, changed }
}

function applySemanticRegistration(
	nodes: readonly MarkdownPortableNode[],
	entry: RegistryEntry<MarkdownSemanticRegistration>,
	surface: MarkdownSemanticSurface,
): PortableNodeTransformResult {
	return transformPortableTextNodes(nodes, (node) => {
		try {
			const transformed = entry.value.transform({
				surface,
				node,
				source: node.value,
			})
			if (transformed === null) return { nodes: [node], changed: false }
			const transformedNodes = normalizePortableNodes(transformed)
			validatePortableNodes(transformedNodes)
			return { nodes: transformedNodes, changed: true }
		} catch (error) {
			reportMarkdownDiagnostic({
				registrationId: entry.value.id,
				namespace: entry.namespace,
				severity: "error",
				message: error instanceof Error ? error.message : String(error),
			})
			return { nodes: [node], changed: false }
		}
	})
}

function applyInlineRegistrations(
	nodes: readonly MarkdownPortableNode[],
): PortableNodeTransformResult {
	return transformPortableTextNodes(nodes, (node) => {
		const transforms = getInlineTextTransforms(node.value)
		if (transforms.length === 0) return { nodes: [node], changed: false }
		const transformedNodes: MarkdownPortableNode[] = []
		let position = 0
		for (const transform of transforms) {
			if (position < transform.from) {
				transformedNodes.push({ type: "text", value: node.value.slice(position, transform.from) })
			}
			transformedNodes.push(...transform.nodes)
			position = transform.to
		}
		if (position < node.value.length) {
			transformedNodes.push({ type: "text", value: node.value.slice(position) })
		}
		return { nodes: transformedNodes, changed: true }
	})
}

export function getMarkdownTextTransforms(
	source: string,
	surface: MarkdownSemanticSurface,
): MarkdownTextTransform[] {
	let nodes: readonly MarkdownPortableNode[] = [{ type: "text", value: source }]
	let semanticChanged = false
	for (const entry of sortEntries(semanticEntries)) {
		const transformed = applySemanticRegistration(nodes, entry, surface)
		nodes = transformed.nodes
		semanticChanged ||= transformed.changed
	}
	if (!semanticChanged) return getInlineTextTransforms(source)

	nodes = applyInlineRegistrations(nodes).nodes
	return [{ from: 0, to: source.length, nodes }]
}

export function hasMarkdownTextRegistrations(): boolean {
	return inlineEntries.length > 0 || semanticEntries.length > 0
}

export function getMarkdownRegistryVersion(): number {
	return registryVersion
}

export function subscribeMarkdownRegistry(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function reportMarkdownDiagnostic(diagnostic: MarkdownDiagnostic): void {
	for (const listener of diagnosticListeners) {
		try {
			listener(diagnostic)
		} catch (error) {
			console.error("[Markdown diagnostic listener failed]", {
				registrationId: diagnostic.registrationId,
				namespace: diagnostic.namespace,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}
}

export function subscribeMarkdownDiagnostics(
	listener: (diagnostic: MarkdownDiagnostic) => void,
): () => void {
	diagnosticListeners.add(listener)
	return () => diagnosticListeners.delete(listener)
}
