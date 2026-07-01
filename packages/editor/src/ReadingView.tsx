import "./markdown.css"
import {
	getCalloutRegistryVersion,
	getMarkdownRegistryVersion,
	getSharedRenderer,
	type SanitizedMarkdownHtml,
	sanitizeRenderedMarkdownHtml,
	subscribeCalloutTypes,
	subscribeMarkdownRegistry,
} from "@cortex/renderer"
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react"
import {
	type CodeBlockEmbedDefinition,
	findCodeBlockEmbedDefinition,
	getCodeBlockEmbedLanguages,
	getCodeBlockEmbedSignature,
	type ParsedCodeBlockEmbed,
	parseFencedCodeBlocks,
} from "./codeBlockEmbeds"
import {
	findLineEmbedDefinition,
	getLineEmbedSignature,
	type LineEmbedDefinition,
	type ParsedLineEmbed,
	parseLineEmbeds,
} from "./lineEmbeds"

interface Props {
	content: string
	scrollMode?: "internal" | "parent"
	renderDelay?: number
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[]
	lineEmbeds?: readonly LineEmbedDefinition[]
	onWikiLinkClick?: (target: string) => void
	onExternalLinkClick?: (url: string) => void
	onTaskCheckboxToggle?: (offset: number, checked: boolean) => void
}

interface MarkdownRenderPiece {
	type: "markdown"
	id: string
	sourceFrom: number
	sourceTo: number
	html: SanitizedMarkdownHtml
}

interface CodeBlockEmbedRenderPiece {
	type: "embed"
	id: string
	block: ParsedCodeBlockEmbed
}

interface LineEmbedRenderPiece {
	type: "line-embed"
	id: string
	embed: ParsedLineEmbed
}

type RenderPiece = MarkdownRenderPiece | CodeBlockEmbedRenderPiece | LineEmbedRenderPiece

interface MarkdownPlanPiece {
	type: "markdown"
	id: string
	sourceFrom: number
	sourceTo: number
	content: string
}

interface CodeBlockEmbedPlanPiece {
	type: "embed"
	id: string
	block: ParsedCodeBlockEmbed
}

interface LineEmbedPlanPiece {
	type: "line-embed"
	id: string
	embed: ParsedLineEmbed
}

type RenderPlanPiece = MarkdownPlanPiece | CodeBlockEmbedPlanPiece | LineEmbedPlanPiece

interface RenderedMarkdown {
	content: string
	registryVersion: string
	embedSignature: string
	html: SanitizedMarkdownHtml
	pieces: readonly RenderPiece[] | null
}

function subscribeRendererRegistry(listener: () => void): () => void {
	const unsubscribeMarkdown = subscribeMarkdownRegistry(listener)
	const unsubscribeCallouts = subscribeCalloutTypes(listener)
	return () => {
		unsubscribeMarkdown()
		unsubscribeCallouts()
	}
}

function getRendererRegistryVersion(): string {
	return `${getMarkdownRegistryVersion()}:${getCalloutRegistryVersion()}`
}

function rangeContains(
	range: Pick<ParsedCodeBlockEmbed, "sourceFrom" | "sourceTo">,
	from: number,
	to: number,
): boolean {
	return range.sourceFrom <= from && to <= range.sourceTo
}

function createRenderPlan(
	content: string,
	codeBlockEmbeds: readonly CodeBlockEmbedDefinition[] | undefined,
	lineEmbeds: readonly LineEmbedDefinition[] | undefined,
): RenderPlanPiece[] | null {
	const languages = getCodeBlockEmbedLanguages(codeBlockEmbeds)
	const codeBlocks = languages.length > 0 ? parseFencedCodeBlocks(content, languages) : []
	const lineBlocks = parseLineEmbeds(content, lineEmbeds).filter(
		(embed) =>
			!codeBlocks.some((block) =>
				rangeContains(block, embed.sourceFrom, Math.max(embed.sourceFrom, embed.sourceTo - 1)),
			),
	)
	if (codeBlocks.length === 0 && lineBlocks.length === 0) return null
	const embeds: Array<CodeBlockEmbedPlanPiece | LineEmbedPlanPiece> = [
		...codeBlocks.map(
			(block): CodeBlockEmbedPlanPiece => ({
				type: "embed",
				id: `embed:${block.sourceFrom}:${block.sourceTo}:${block.language}`,
				block,
			}),
		),
		...lineBlocks.map(
			(embed): LineEmbedPlanPiece => ({
				type: "line-embed",
				id: `line-embed:${embed.sourceFrom}:${embed.sourceTo}:${embed.definitionId}`,
				embed,
			}),
		),
	].sort((left, right) => {
		const leftFrom = left.type === "embed" ? left.block.sourceFrom : left.embed.sourceFrom
		const rightFrom = right.type === "embed" ? right.block.sourceFrom : right.embed.sourceFrom
		return leftFrom - rightFrom
	})

	const pieces: RenderPlanPiece[] = []
	let cursor = 0
	for (const embed of embeds) {
		const sourceFrom = embed.type === "embed" ? embed.block.sourceFrom : embed.embed.sourceFrom
		const sourceTo = embed.type === "embed" ? embed.block.sourceTo : embed.embed.sourceTo
		if (sourceFrom < cursor) continue
		if (sourceFrom > cursor) {
			pieces.push({
				type: "markdown",
				id: `markdown:${cursor}:${sourceFrom}`,
				sourceFrom: cursor,
				sourceTo: sourceFrom,
				content: content.slice(cursor, sourceFrom),
			})
		}
		pieces.push(embed)
		cursor = sourceTo
	}
	if (cursor < content.length) {
		pieces.push({
			type: "markdown",
			id: `markdown:${cursor}:${content.length}`,
			sourceFrom: cursor,
			sourceTo: content.length,
			content: content.slice(cursor),
		})
	}
	return pieces
}

function adjustRenderedTaskOffsets(
	html: SanitizedMarkdownHtml,
	sourceOffset: number,
): SanitizedMarkdownHtml {
	if (sourceOffset === 0 || typeof document === "undefined") return html
	const template = document.createElement("template")
	template.innerHTML = html
	for (const element of template.content.querySelectorAll<HTMLElement>("[data-offset]")) {
		const offset = Number(element.dataset.offset)
		if (Number.isFinite(offset)) element.dataset.offset = String(offset + sourceOffset)
	}
	return template.innerHTML as SanitizedMarkdownHtml
}

async function renderMarkdownPiece(piece: MarkdownPlanPiece): Promise<MarkdownRenderPiece> {
	const prefix = piece.sourceFrom === 0 ? "" : "\n"
	const renderedHtml = await getSharedRenderer().render(`${prefix}${piece.content}`)
	return {
		type: "markdown",
		id: piece.id,
		sourceFrom: piece.sourceFrom,
		sourceTo: piece.sourceTo,
		html: adjustRenderedTaskOffsets(renderedHtml, piece.sourceFrom - prefix.length),
	}
}

export function ReadingView({
	content,
	scrollMode = "internal",
	renderDelay = 0,
	codeBlockEmbeds,
	lineEmbeds,
	onWikiLinkClick,
	onExternalLinkClick,
	onTaskCheckboxToggle,
}: Props) {
	const [renderedMarkdown, setRenderedMarkdown] = useState<RenderedMarkdown | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const renderRequestRef = useRef(0)
	const handleWikiLinkClick = useEffectEvent((target: string) => {
		onWikiLinkClick?.(target)
	})
	const handleExternalLinkClick = useEffectEvent((url: string) => {
		onExternalLinkClick?.(url)
	})
	const handleTaskCheckboxToggle = useEffectEvent((offset: number, checked: boolean) => {
		onTaskCheckboxToggle?.(offset, checked)
	})
	const rendererRegistryVersion = useSyncExternalStore(
		subscribeRendererRegistry,
		getRendererRegistryVersion,
		getRendererRegistryVersion,
	)
	const embedSignature = getCodeBlockEmbedSignature(codeBlockEmbeds)
	const lineEmbedSignature = getLineEmbedSignature(lineEmbeds)
	const combinedEmbedSignature = `${embedSignature}:${lineEmbedSignature}`
	const renderedContentMatches =
		renderedMarkdown?.content === content &&
		renderedMarkdown.registryVersion === rendererRegistryVersion &&
		renderedMarkdown.embedSignature === combinedEmbedSignature
	const html =
		renderedContentMatches && renderedMarkdown.pieces === null ? renderedMarkdown.html : ""
	const pieces = renderedContentMatches ? renderedMarkdown.pieces : null

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- cleanup intentionally invalidates the latest async render request
	useEffect(() => {
		const request = ++renderRequestRef.current
		const registryVersion = rendererRegistryVersion
		const requestedContent = content
		const requestedEmbedSignature = combinedEmbedSignature
		const render = () => {
			const renderPlan = createRenderPlan(content, codeBlockEmbeds, lineEmbeds)
			const renderPromise = renderPlan
				? Promise.all(
						renderPlan.map((piece): Promise<RenderPiece> => {
							if (piece.type === "embed" || piece.type === "line-embed") {
								return Promise.resolve(piece)
							}
							return renderMarkdownPiece(piece)
						}),
					).then((renderedPieces) => ({
						html: "" as SanitizedMarkdownHtml,
						pieces: renderedPieces,
					}))
				: getSharedRenderer()
						.render(content)
						.then((renderedHtml) => ({
							html: renderedHtml,
							pieces: null,
						}))
			void renderPromise.then((rendered) => {
				if (
					request === renderRequestRef.current &&
					registryVersion === getRendererRegistryVersion() &&
					requestedEmbedSignature ===
						`${getCodeBlockEmbedSignature(codeBlockEmbeds)}:${getLineEmbedSignature(lineEmbeds)}`
				) {
					setRenderedMarkdown({
						content: requestedContent,
						registryVersion,
						embedSignature: requestedEmbedSignature,
						html: rendered.html,
						pieces: rendered.pieces,
					})
				}
			})
		}
		const timeout = renderDelay === 0 ? undefined : setTimeout(render, renderDelay)
		if (renderDelay === 0) render()
		return () => {
			if (timeout) clearTimeout(timeout)
			if (renderRequestRef.current === request) renderRequestRef.current++
		}
	}, [
		content,
		codeBlockEmbeds,
		combinedEmbedSignature,
		lineEmbeds,
		renderDelay,
		rendererRegistryVersion,
	])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const handleClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement

			const wikiLink = target.closest("[data-wiki-link]") as HTMLElement | null
			if (wikiLink) {
				event.preventDefault()
				const linkTarget = wikiLink.getAttribute("data-wiki-link")
				if (linkTarget) handleWikiLinkClick(linkTarget)
				return
			}

			const externalLink = target.closest<HTMLAnchorElement>("a[href]")
			const externalUrl = externalLink?.getAttribute("href")
			if (externalUrl && /^(https?:|mailto:)/i.test(externalUrl)) {
				event.preventDefault()
				handleExternalLinkClick(externalUrl)
				return
			}

			const checkbox = target.closest("[data-task-checkbox]") as HTMLElement | null
			if (checkbox) {
				event.preventDefault()
				const listItem = checkbox.closest("[data-task-item]") as HTMLElement | null
				if (listItem) {
					const isChecked = listItem.getAttribute("data-task-item") === "checked"
					const offset = Number(listItem.getAttribute("data-offset") ?? -1)
					handleTaskCheckboxToggle(offset, !isChecked)
				}
			}
		}

		const handleToggle = (event: Event) => {
			const callout = event.target
			if (!(callout instanceof HTMLDetailsElement)) return
			if (!callout.classList.contains("markdown-callout")) return
			callout.classList.toggle("is-collapsed", !callout.open)
		}

		container.addEventListener("click", handleClick)
		container.addEventListener("toggle", handleToggle, true)
		return () => {
			container.removeEventListener("click", handleClick)
			container.removeEventListener("toggle", handleToggle, true)
		}
	}, [])

	useEffect(() => {
		if (!renderedMarkdown) return
		const container = containerRef.current
		if (!container?.querySelector(".katex")) return
		let disposed = false
		void import("./mathStylesheet")
			.then((stylesheet) => {
				if (disposed) return undefined
				return stylesheet.ensureMathStylesheet()
			})
			.catch(() => undefined)
		return () => {
			disposed = true
		}
	}, [renderedMarkdown])

	return (
		<div
			ref={containerRef}
			className={`reading-view reading-view-${scrollMode}-scroll markdown-surface`}
		>
			{pieces ? (
				pieces.map((piece) => {
					if (piece.type === "markdown") {
						return (
							<div
								key={piece.id}
								className="reading-view-content"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: content passes through the renderer sanitizer
								dangerouslySetInnerHTML={{
									__html: sanitizeRenderedMarkdownHtml(piece.html),
								}}
							/>
						)
					}
					if (piece.type === "embed") {
						const definition = findCodeBlockEmbedDefinition(codeBlockEmbeds, piece.block.language)
						return (
							<div key={piece.id} className="reading-view-content reading-view-embed-content">
								{definition?.render({
									block: piece.block,
									content: piece.block.content,
									sourceFrom: piece.block.sourceFrom,
									sourceTo: piece.block.sourceTo,
								})}
							</div>
						)
					}
					const definition = findLineEmbedDefinition(lineEmbeds, piece.embed.definitionId)
					return (
						<div key={piece.id} className="reading-view-content reading-view-embed-content">
							{definition?.render({
								embed: piece.embed,
								line: piece.embed.line,
								data: piece.embed.data,
								sourceFrom: piece.embed.sourceFrom,
								sourceTo: piece.embed.sourceTo,
							})}
						</div>
					)
				})
			) : (
				<div
					className="reading-view-content"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: content passes through the renderer sanitizer
					dangerouslySetInnerHTML={{ __html: sanitizeRenderedMarkdownHtml(html) }}
				/>
			)}
		</div>
	)
}
