import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CopyCodeButton } from "./DocCards"

interface RenderedMarkdownProps {
	html: string
	className?: string
}

export function RenderedMarkdown({ html, className }: RenderedMarkdownProps) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [codeFrames, setCodeFrames] = useState<HTMLElement[]>([])

	useEffect(() => {
		const container = containerRef.current
		if (!container || !html) return
		setCodeFrames(Array.from(container.querySelectorAll<HTMLElement>("[data-code-frame]")))
	}, [html])

	return (
		<>
			<div
				ref={containerRef}
				className={className}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown HTML is sanitized by renderReleaseMarkdown on the server.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{codeFrames.map((frame, index) => {
				const bar = frame.querySelector<HTMLElement>("[data-code-bar]")
				if (!bar) return null
				return createPortal(
					<CopyCodeButton getText={() => frame.querySelector("pre")?.innerText ?? ""} />,
					bar,
					String(index),
				)
			})}
		</>
	)
}
