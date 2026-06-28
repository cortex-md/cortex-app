import { type EditorMode, useEditorStore } from "@cortex/core"
import { usePluginStore } from "@cortex/plugin-host-web"
import { LucideIcon } from "@cortex/ui"
import { SyncIndicator } from "../sync/SyncIndicator"

const MODE_LABELS: Record<EditorMode, string> = {
	source: "Source",
	"live-preview": "Preview",
	reading: "Reading",
	"side-by-side": "Side by Side",
}

const NEXT_MODE: Record<EditorMode, EditorMode> = {
	source: "live-preview",
	"live-preview": "reading",
	reading: "side-by-side",
	"side-by-side": "source",
}

export function StatusBar() {
	const cursor = useEditorStore((s) => s.cursor)
	const mode = useEditorStore((s) => s.mode)
	const setMode = useEditorStore((s) => s.setMode)
	const statusBarItems = usePluginStore((s) => s.statusBarItems)

	const leftPluginItems = statusBarItems.filter((item) => item.position === "left")
	const rightPluginItems = statusBarItems.filter((item) => item.position === "right")

	return (
		<div className="app-statusbar">
			<div className="statusbar-left">
				{leftPluginItems.map((item) => (
					<button
						key={item.registrationKey}
						type="button"
						className="statusbar-item statusbar-btn"
						onClick={item.onClick}
						title={item.tooltip}
					>
						{item.icon && <LucideIcon name={item.icon} size={12} />}
						{item.text && <span>{item.text}</span>}
					</button>
				))}
			</div>

			<div className="statusbar-sep" />

			<div className="statusbar-right">
				<SyncIndicator />
				{rightPluginItems.map((item) => (
					<button
						key={item.registrationKey}
						type="button"
						className="statusbar-item statusbar-btn"
						onClick={item.onClick}
						title={item.tooltip}
					>
						{item.icon && <LucideIcon name={item.icon} size={12} />}
						{item.text && <span>{item.text}</span>}
					</button>
				))}
				{cursor && (
					<span className="statusbar-item statusbar-cursor">
						Ln {cursor.line + 1}, Col {cursor.col + 1}
					</span>
				)}
				<button
					type="button"
					className="statusbar-item statusbar-btn"
					onClick={() => setMode(NEXT_MODE[mode])}
					title="Cycle editor mode"
				>
					{MODE_LABELS[mode]}
				</button>
			</div>
		</div>
	)
}
