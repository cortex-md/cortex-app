import { ReadingView } from "@cortex/editor/reading-view"
import { getPlatform } from "@cortex/platform"
import type { CoreViewProps } from "../split-view/coreViewRegistry"
import { SYNC_WELCOME_MARKDOWN } from "./syncWelcome"

function readString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value : null
}

export function SyncWelcomeView({ viewState }: CoreViewProps) {
	const content = readString(viewState.content) ?? SYNC_WELCOME_MARKDOWN

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
