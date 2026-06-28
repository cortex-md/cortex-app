import { ReadingView } from "@cortex/editor/reading-view"
import { getPlatform } from "@cortex/platform"
import type { CoreViewProps } from "../split-view/coreViewRegistry"

function readMarkdownContent(value: unknown): string {
	return typeof value === "string" ? value : ""
}

export function PluginMarkdownNoteView({ viewState }: CoreViewProps) {
	const content = readMarkdownContent(viewState.content)

	return (
		<div className="note-document-scroll">
			<div className="note-document-surface">
				<ReadingView
					content={content}
					scrollMode="parent"
					onExternalLinkClick={(url) => {
						void getPlatform().app.openExternalUrl(url)
					}}
				/>
			</div>
		</div>
	)
}
