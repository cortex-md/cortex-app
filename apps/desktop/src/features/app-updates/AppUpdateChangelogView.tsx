import { ReadingView } from "@cortex/editor/reading-view"
import { getPlatform } from "@cortex/platform"
import type { CoreViewProps } from "../split-view/coreViewRegistry"

function readString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value : null
}

export function AppUpdateChangelogView({ viewState }: CoreViewProps) {
	const version = readString(viewState.version)
	const content =
		readString(viewState.content) ?? `# Cortex ${version ?? ""}\n\nNo changelog found.`

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
