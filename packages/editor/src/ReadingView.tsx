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

interface Props {
	content: string
	scrollMode?: "internal" | "parent"
	renderDelay?: number
	onWikiLinkClick?: (target: string) => void
	onExternalLinkClick?: (url: string) => void
	onTaskCheckboxToggle?: (offset: number, checked: boolean) => void
}

interface RenderedMarkdown {
	content: string
	registryVersion: string
	html: SanitizedMarkdownHtml
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

export function ReadingView({
	content,
	scrollMode = "internal",
	renderDelay = 0,
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
	const html =
		renderedMarkdown?.content === content &&
		renderedMarkdown.registryVersion === rendererRegistryVersion
			? renderedMarkdown.html
			: ""

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- cleanup intentionally invalidates the latest async render request
	useEffect(() => {
		const request = ++renderRequestRef.current
		const registryVersion = rendererRegistryVersion
		const requestedContent = content
		const render = () => {
			void getSharedRenderer()
				.render(content)
				.then((renderedHtml) => {
					if (
						request === renderRequestRef.current &&
						registryVersion === getRendererRegistryVersion()
					) {
						setRenderedMarkdown({
							content: requestedContent,
							registryVersion,
							html: renderedHtml,
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
	}, [content, renderDelay, rendererRegistryVersion])

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

	return (
		<div
			ref={containerRef}
			className={`reading-view reading-view-${scrollMode}-scroll markdown-surface`}
		>
			<div
				className="reading-view-content"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: content passes through the renderer sanitizer
				dangerouslySetInnerHTML={{ __html: sanitizeRenderedMarkdownHtml(html) }}
			/>
		</div>
	)
}
