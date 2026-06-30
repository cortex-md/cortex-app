import { hashMermaidSource, normalizeMermaidSource } from "./mermaidDocument"

export type MermaidRenderState =
	| {
			status: "success"
			svg: string
			sourceHash: string
			themeSignature: string
	  }
	| {
			status: "error"
			message: string
			sourceHash: string
			themeSignature: string
	  }

interface MermaidApi {
	initialize: (config: Record<string, unknown>) => void
	render: (id: string, source: string) => Promise<{ svg: string }>
}

interface DOMPurifyApi {
	sanitize: (svg: string, config: Record<string, unknown>) => string
}

interface MermaidDependencies {
	mermaid: MermaidApi
	dompurify: DOMPurifyApi
}

interface MermaidThemeSnapshot {
	signature: string
	variables: Record<string, string>
}

interface MermaidCachedSuccess {
	status: "success"
	svg: string
	sourceHash: string
	themeSignature: string
}

type MermaidCachedRender =
	| MermaidCachedSuccess
	| {
			status: "error"
			message: string
			sourceHash: string
			themeSignature: string
	  }

const renderCacheLimit = 64
const renderCache = new Map<string, Promise<MermaidCachedRender>>()
let dependenciesPromise: Promise<MermaidDependencies> | null = null
let renderQueue = Promise.resolve()
let renderIdCounter = 0
let svgNamespaceCounter = 0

function getCssVariable(style: CSSStyleDeclaration | null, name: string, fallback: string): string {
	const value = style?.getPropertyValue(name).trim()
	return value || fallback
}

export function getMermaidThemeSnapshot(): MermaidThemeSnapshot {
	if (typeof document === "undefined") {
		return {
			signature: "server",
			variables: {},
		}
	}

	const style = getComputedStyle(document.body)
	const background = getCssVariable(style, "--bg-primary", "#ffffff")
	const secondaryBackground = getCssVariable(style, "--bg-secondary", "#f6f6f7")
	const border = getCssVariable(style, "--border-subtle", "#d7d7dc")
	const text = getCssVariable(style, "--text-primary", "#24252d")
	const mutedText = getCssVariable(style, "--text-muted", "#6c6f7a")
	const accent = getCssVariable(style, "--accent", "#5b6ee1")
	const fontFamily = getCssVariable(style, "--font-ui", "system-ui, sans-serif")
	const scheme = document.body.dataset.themeScheme ?? document.body.dataset.colorScheme ?? "light"
	const signature = [
		scheme,
		background,
		secondaryBackground,
		border,
		text,
		mutedText,
		accent,
		fontFamily,
	].join("|")

	return {
		signature,
		variables: {
			background,
			mainBkg: secondaryBackground,
			secondBkg: background,
			primaryColor: secondaryBackground,
			primaryTextColor: text,
			primaryBorderColor: border,
			secondaryTextColor: text,
			tertiaryTextColor: text,
			textColor: text,
			titleColor: text,
			nodeTextColor: text,
			noteTextColor: text,
			lineColor: mutedText,
			secondaryColor: background,
			tertiaryColor: secondaryBackground,
			nodeBorder: border,
			clusterBkg: background,
			clusterBorder: border,
			defaultLinkColor: mutedText,
			edgeLabelBackground: background,
			fontFamily,
		},
	}
}

export function getMermaidThemeSignature(): string {
	return getMermaidThemeSnapshot().signature
}

function resolveModuleDefault<T>(module: unknown): T {
	if (module && typeof module === "object" && "default" in module) {
		return (module as { default: T }).default
	}
	return module as T
}

async function loadMermaidDependencies(): Promise<MermaidDependencies> {
	dependenciesPromise ??= Promise.all([import("mermaid"), import("dompurify")]).then(
		([mermaidModule, dompurifyModule]) => ({
			mermaid: resolveModuleDefault<MermaidApi>(mermaidModule),
			dompurify: resolveModuleDefault<DOMPurifyApi>(dompurifyModule),
		}),
	)
	return dependenciesPromise
}

function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
	const next = renderQueue.then(task, task)
	renderQueue = next.then(
		() => undefined,
		() => undefined,
	)
	return next
}

function rememberRender(cacheKey: string, promise: Promise<MermaidCachedRender>): void {
	renderCache.set(cacheKey, promise)
	while (renderCache.size > renderCacheLimit) {
		const oldestKey = renderCache.keys().next().value
		if (!oldestKey) break
		renderCache.delete(oldestKey)
	}
}

function formatMermaidError(error: unknown): string {
	const rawMessage = error instanceof Error ? error.message : String(error)
	const firstLine = rawMessage
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean)
	return (firstLine || "The Mermaid diagram could not be rendered.").slice(0, 180)
}

function createMermaidConfig(theme: MermaidThemeSnapshot): Record<string, unknown> {
	return {
		startOnLoad: false,
		securityLevel: "strict",
		theme: "base",
		htmlLabels: false,
		themeVariables: theme.variables,
		flowchart: {
			htmlLabels: false,
		},
	}
}

function removeUnsafeSvgAttributes(svgElement: SVGElement): void {
	for (const element of [svgElement, ...Array.from(svgElement.querySelectorAll("*"))]) {
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase()
			const value = attribute.value.trim()
			if (name.startsWith("on")) element.removeAttribute(attribute.name)
			if ((name === "href" || name === "xlink:href") && /^javascript:/i.test(value)) {
				element.removeAttribute(attribute.name)
			}
		}
	}
}

function parseSvg(svg: string): SVGElement | null {
	if (typeof document === "undefined") return null
	const template = document.createElement("template")
	template.innerHTML = svg.trim()
	const element = template.content.firstElementChild
	return element instanceof SVGElement && element.tagName.toLowerCase() === "svg" ? element : null
}

export function namespaceMermaidSvg(svg: string, namespace: string): string {
	const svgElement = parseSvg(svg)
	if (!svgElement) return svg

	const idMap = new Map<string, string>()
	for (const element of Array.from(svgElement.querySelectorAll<HTMLElement>("[id]"))) {
		const oldId = element.id
		const nextId = `${namespace}-${oldId}`
		idMap.set(oldId, nextId)
		element.id = nextId
	}

	if (idMap.size === 0) return svgElement.outerHTML

	for (const styleElement of Array.from(svgElement.querySelectorAll("style"))) {
		let text = styleElement.textContent ?? ""
		for (const [oldId, nextId] of idMap) {
			text = text.replaceAll(`#${oldId}`, `#${nextId}`)
			text = text.replaceAll(`url(#${oldId})`, `url(#${nextId})`)
		}
		styleElement.textContent = text
	}

	for (const element of Array.from(svgElement.querySelectorAll("*"))) {
		for (const attribute of Array.from(element.attributes)) {
			let nextValue = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id: string) => {
				const nextId = idMap.get(id)
				return nextId ? `url(#${nextId})` : match
			})

			if (nextValue.startsWith("#")) {
				const nextId = idMap.get(nextValue.slice(1))
				if (nextId) nextValue = `#${nextId}`
			}

			if (attribute.name === "aria-labelledby" || attribute.name === "aria-describedby") {
				nextValue = nextValue
					.split(/\s+/)
					.map((id) => idMap.get(id) ?? id)
					.join(" ")
			}

			if (nextValue !== attribute.value) element.setAttribute(attribute.name, nextValue)
		}
	}

	return svgElement.outerHTML
}

export function sanitizeMermaidSvg(svg: string, dompurify: DOMPurifyApi): string {
	const sanitized = dompurify.sanitize(svg, {
		USE_PROFILES: { svg: true, svgFilters: true },
		FORBID_TAGS: ["foreignObject", "script"],
	})
	const svgElement = parseSvg(sanitized)
	if (!svgElement) throw new Error("Mermaid returned invalid SVG.")

	svgElement.querySelectorAll("foreignObject, script").forEach((element) => {
		element.remove()
	})
	removeUnsafeSvgAttributes(svgElement)
	svgElement.setAttribute("role", "img")
	svgElement.setAttribute("focusable", "false")
	return svgElement.outerHTML
}

function createSvgNamespace(sourceHash: string): string {
	svgNamespaceCounter++
	return `${sourceHash}-${svgNamespaceCounter.toString(36)}`
}

async function renderMermaidSource(
	source: string,
	sourceHash: string,
	theme: MermaidThemeSnapshot,
): Promise<MermaidCachedRender> {
	if (!source.trim()) {
		return {
			status: "error",
			message: "The Mermaid diagram is empty.",
			sourceHash,
			themeSignature: theme.signature,
		}
	}

	try {
		const dependencies = await loadMermaidDependencies()
		return await enqueueMermaidRender(async () => {
			renderIdCounter++
			const renderId = `mermaid-${sourceHash}-${renderIdCounter.toString(36)}`
			dependencies.mermaid.initialize(createMermaidConfig(theme))
			const rendered = await dependencies.mermaid.render(renderId, source)
			return {
				status: "success",
				svg: sanitizeMermaidSvg(rendered.svg, dependencies.dompurify),
				sourceHash,
				themeSignature: theme.signature,
			}
		})
	} catch (error) {
		return {
			status: "error",
			message: formatMermaidError(error),
			sourceHash,
			themeSignature: theme.signature,
		}
	}
}

export async function renderMermaidDiagram(source: string): Promise<MermaidRenderState> {
	const normalized = normalizeMermaidSource(source)
	const sourceHash = hashMermaidSource(normalized)
	const theme = getMermaidThemeSnapshot()
	const cacheKey = `${sourceHash}:${theme.signature}`
	const existing = renderCache.get(cacheKey)
	const promise = existing ?? renderMermaidSource(normalized, sourceHash, theme)
	if (!existing) rememberRender(cacheKey, promise)
	const result = await promise

	if (result.status === "success") {
		return {
			...result,
			svg: namespaceMermaidSvg(result.svg, createSvgNamespace(sourceHash)),
		}
	}

	return result
}

export function clearMermaidRenderCache(): void {
	renderCache.clear()
}
