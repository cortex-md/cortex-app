import rehypeHighlight from "rehype-highlight"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import remarkFrontmatterSyntax from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import type { Plugin } from "unified"
import { unified } from "unified"
import { getCalloutRegistryVersion } from "./callouts/registry"
import {
	createRendererFeatureData,
	detectRendererFeatureFlags,
	getRendererFeatureFlags,
} from "./features"
import { rehypeCallouts } from "./plugins/callouts"
import { remarkStripFrontmatter } from "./plugins/frontmatter"
import { createRehypeSemanticRegistrations } from "./plugins/semanticRegistrations"
import { remarkFastTables } from "./plugins/tables"
import { rehypeTaskList } from "./plugins/taskList"
import { rehypeMarkdownUrlPolicy } from "./plugins/urlPolicy"
import { rehypeWikiLinks } from "./plugins/wikiLinks"
import {
	getMarkdownPreprocessorEntries,
	getMarkdownProcessorEntries,
	getMarkdownRegistryVersion,
	hasMarkdownTextRegistrations,
	type MarkdownPreprocessorRegistration,
	type MarkdownProcessorRegistration,
	type MarkdownSurface,
	type RegisteredMarkdownPreprocessor,
	type RegisteredMarkdownProcessor,
	reportMarkdownDiagnostic,
	validateMarkdownPreprocessorRegistration,
	validateMarkdownProcessorRegistration,
} from "./registry"
import type { Renderer, RendererOptions, SanitizedMarkdownHtml } from "./types"

interface ProcessorHealth {
	failures: number
	slowRuns: number
	disabled: boolean
}

const processorHealth = new WeakMap<MarkdownProcessorRegistration, ProcessorHealth>()
const preprocessorHealth = new WeakMap<MarkdownPreprocessorRegistration, ProcessorHealth>()
const slowProcessorThresholdMs = 100
const disableThreshold = 3

const markdownSanitizeSchema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), "aside", "svg", "path"],
	attributes: {
		...defaultSchema.attributes,
		"*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
		a: [...(defaultSchema.attributes?.a ?? []), "data-wiki-link"],
		aside: ["className", "data-callout", "data-callout-fold", "style"],
		details: [
			...(defaultSchema.attributes?.details ?? []),
			"className",
			"data-callout",
			"data-callout-fold",
			"style",
		],
		div: [...(defaultSchema.attributes?.div ?? []), "className"],
		li: [...(defaultSchema.attributes?.li ?? []), "className", "data-offset", "data-task-item"],
		path: ["className", "d", "pathLength"],
		span: [
			...(defaultSchema.attributes?.span ?? []),
			"aria-checked",
			"className",
			"data-state",
			"data-task-checkbox",
			"role",
		],
		summary: [...(defaultSchema.attributes?.summary ?? []), "className", "data-callout-toggle"],
		svg: ["aria-hidden", "className", "focusable", "viewBox"],
	},
	protocols: {
		...defaultSchema.protocols,
		href: ["http", "https", "mailto"],
		src: ["http", "https", "asset", "cortex", "data", "blob"],
	},
}

function getProcessorHealth(registration: MarkdownProcessorRegistration): ProcessorHealth {
	const existing = processorHealth.get(registration)
	if (existing) return existing
	const created = { failures: 0, slowRuns: 0, disabled: false }
	processorHealth.set(registration, created)
	return created
}

function getPreprocessorHealth(registration: MarkdownPreprocessorRegistration): ProcessorHealth {
	const existing = preprocessorHealth.get(registration)
	if (existing) return existing
	const created = { failures: 0, slowRuns: 0, disabled: false }
	preprocessorHealth.set(registration, created)
	return created
}

function isMarkdownUnifiedNode(value: unknown): value is { type: string } {
	return (
		typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
	)
}

function createIsolatedProcessor(entry: RegisteredMarkdownProcessor): Plugin {
	return function isolatedProcessor() {
		const registration = entry.registration
		const health = getProcessorHealth(registration)
		const transformer = registration.processor.call(this)
		if (typeof transformer !== "function") return

		return async (tree, file) => {
			if (health.disabled) return tree
			const startedAt = performance.now()
			try {
				const workingTree = structuredClone(tree)
				const transformed = await transformer.call(this, workingTree as never, file as never)
				const durationMs = performance.now() - startedAt
				health.failures = 0
				if (durationMs >= slowProcessorThresholdMs) {
					health.slowRuns++
					reportMarkdownDiagnostic({
						registrationId: registration.id,
						namespace: entry.namespace,
						severity: "warning",
						message: `Markdown processor took ${Math.round(durationMs)}ms`,
						durationMs,
					})
					if (health.slowRuns >= disableThreshold) health.disabled = true
				} else {
					health.slowRuns = 0
				}
				if (transformed === undefined) return workingTree
				if (!isMarkdownUnifiedNode(transformed)) {
					throw new Error("Markdown processor returned an invalid syntax tree")
				}
				return transformed
			} catch (error) {
				health.failures++
				if (health.failures >= disableThreshold) health.disabled = true
				reportMarkdownDiagnostic({
					registrationId: registration.id,
					namespace: entry.namespace,
					severity: "error",
					message: `${error instanceof Error ? error.message : String(error)}${
						health.disabled ? "; disabled for this session" : ""
					}`,
				})
				return tree
			}
		}
	}
}

function applyProcessors(pipeline: unknown, entries: RegisteredMarkdownProcessor[]): void {
	const processor = pipeline as { use(plugin: Plugin): void }
	for (const entry of entries) processor.use(createIsolatedProcessor(entry))
}

type RehypeHighlightTransformer = (tree: unknown, file: unknown) => unknown
type RehypeHighlightPlugin = (
	this: unknown,
	options: { detect: boolean },
) => RehypeHighlightTransformer | undefined

function createConditionalHighlight(): Plugin {
	const plugin = function conditionalHighlight(this: unknown) {
		const transformer = (rehypeHighlight as unknown as RehypeHighlightPlugin).call(this, {
			detect: true,
		})
		if (typeof transformer !== "function") return
		return function transformHighlightedCode(this: unknown, tree: unknown, file: unknown) {
			if (!getRendererFeatureFlags(file).hasCodeBlocks) return tree
			return transformer.call(this, tree, file)
		}
	}
	return plugin as Plugin
}

async function applyPreprocessors(
	markdown: string,
	surface: MarkdownSurface,
	entries: RegisteredMarkdownPreprocessor[],
): Promise<string> {
	let current = markdown
	for (const entry of entries) {
		const registration = entry.registration
		const health = getPreprocessorHealth(registration)
		if (health.disabled) continue
		const startedAt = performance.now()
		try {
			const nextMarkdown = await registration.preprocess(current, { surface })
			const durationMs = performance.now() - startedAt
			health.failures = 0
			if (durationMs >= slowProcessorThresholdMs) {
				health.slowRuns++
				reportMarkdownDiagnostic({
					registrationId: registration.id,
					namespace: entry.namespace,
					severity: "warning",
					message: `Markdown preprocessor took ${Math.round(durationMs)}ms`,
					durationMs,
				})
				if (health.slowRuns >= disableThreshold) health.disabled = true
			} else {
				health.slowRuns = 0
			}
			if (typeof nextMarkdown !== "string") {
				throw new Error("Markdown preprocessor returned a non-string value")
			}
			current = nextMarkdown
		} catch (error) {
			health.failures++
			if (health.failures >= disableThreshold) health.disabled = true
			reportMarkdownDiagnostic({
				registrationId: registration.id,
				namespace: entry.namespace,
				severity: "error",
				message: `${error instanceof Error ? error.message : String(error)}${
					health.disabled ? "; disabled for this session" : ""
				}`,
			})
		}
	}
	return current
}

function getOptionPreprocessors(
	preprocessors: readonly MarkdownPreprocessorRegistration[],
	surface: RendererOptions["surface"],
): RegisteredMarkdownPreprocessor[] {
	const selectedSurface = surface ?? "reading-view"
	const entries: Array<RegisteredMarkdownPreprocessor & { order: number }> = []
	preprocessors.forEach((registration, order) => {
		validateMarkdownPreprocessorRegistration(registration)
		if (!registration.surfaces.includes(selectedSurface)) return
		entries.push({ registration, namespace: "renderer-options", order })
	})
	return entries
		.sort(
			(left, right) =>
				(right.registration.priority ?? 0) - (left.registration.priority ?? 0) ||
				left.order - right.order,
		)
		.map(({ registration, namespace }) => ({ registration, namespace }))
}

function getOptionProcessors(
	processors: readonly MarkdownProcessorRegistration[],
	surface: RendererOptions["surface"],
	phase: MarkdownProcessorRegistration["phase"],
): RegisteredMarkdownProcessor[] {
	const selectedSurface = surface ?? "reading-view"
	const entries: Array<RegisteredMarkdownProcessor & { order: number }> = []
	processors.forEach((registration, order) => {
		validateMarkdownProcessorRegistration(registration)
		if (registration.phase !== phase) return
		if (!registration.surfaces.includes(selectedSurface)) return
		entries.push({ registration, namespace: "renderer-options", order })
	})
	return entries
		.sort(
			(left, right) =>
				(right.registration.priority ?? 0) - (left.registration.priority ?? 0) ||
				left.order - right.order,
		)
		.map(({ registration, namespace }) => ({ registration, namespace }))
}

function createRenderPipeline(
	surface: MarkdownSurface,
	remarkProcessors: RegisteredMarkdownProcessor[],
	rehypeProcessors: RegisteredMarkdownProcessor[],
	useGfm: boolean,
) {
	const pipeline = unified().use(remarkParse).use(remarkFrontmatterSyntax)
	if (useGfm) pipeline.use(remarkGfm)
	else pipeline.use(remarkFastTables)

	applyProcessors(pipeline, remarkProcessors)

	pipeline.use(remarkStripFrontmatter).use(remarkRehype, { allowDangerousHtml: false })

	applyProcessors(pipeline, rehypeProcessors)

	pipeline
		.use(createRehypeSemanticRegistrations(surface))
		.use(rehypeCallouts)
		.use(rehypeWikiLinks)
		.use(rehypeTaskList)
		.use(createConditionalHighlight())
		.use(rehypeMarkdownUrlPolicy)
		.use(rehypeSanitize, markdownSanitizeSchema)
		.use(rehypeStringify)
	return pipeline
}

export function createRenderer(options: RendererOptions = {}): Renderer {
	const surface = options.surface ?? "reading-view"
	const preprocessors = options.preprocessors
	const processors = options.processors
	const selectedPreprocessors =
		(preprocessors && getOptionPreprocessors(preprocessors, surface)) ??
		getMarkdownPreprocessorEntries(surface)
	const remarkProcessors =
		(processors && getOptionProcessors(processors, surface, "remark")) ??
		getMarkdownProcessorEntries(surface, "remark")
	const rehypeProcessors =
		(processors && getOptionProcessors(processors, surface, "rehype")) ??
		getMarkdownProcessorEntries(surface, "rehype")
	const standardPipeline = createRenderPipeline(surface, remarkProcessors, rehypeProcessors, false)
	const gfmPipeline = createRenderPipeline(surface, remarkProcessors, rehypeProcessors, true)

	return {
		render: async (markdown: string) => {
			const preprocessedMarkdown = await applyPreprocessors(
				markdown,
				surface,
				selectedPreprocessors,
			)
			const features = detectRendererFeatureFlags(preprocessedMarkdown, {
				forceAll: remarkProcessors.length > 0 || rehypeProcessors.length > 0,
				hasTextTransforms: hasMarkdownTextRegistrations(),
			})
			const pipeline = features.hasGfmSyntax ? gfmPipeline : standardPipeline
			const result = await pipeline.process({
				value: preprocessedMarkdown,
				data: createRendererFeatureData(features),
			})
			return String(result) as SanitizedMarkdownHtml
		},
	}
}

let sharedRenderer:
	| {
			version: string
			renderer: Renderer
	  }
	| undefined

export function getSharedRenderer(): Renderer {
	const version = `${getMarkdownRegistryVersion()}:${getCalloutRegistryVersion()}`
	if (sharedRenderer?.version !== version) {
		sharedRenderer = {
			version,
			renderer: createRenderer(),
		}
	}
	return sharedRenderer.renderer
}
