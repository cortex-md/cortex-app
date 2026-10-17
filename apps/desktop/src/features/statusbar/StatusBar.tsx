import { executeCommand } from "@cortex/commands"
import { type EditorMode, selectActiveDocument, useEditorStore } from "@cortex/core"
import {
	type RegisteredStatusBarItem,
	selectVisibleStatusBarItems,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { Button, LucideIcon, SimpleTooltip } from "@cortex/ui"
import { type ComponentType, useMemo } from "react"

const MODE_LABELS: Record<EditorMode, string> = {
	source: "Source",
	"live-preview": "Preview",
	reading: "Reading",
	"side-by-side": "Side by Side",
}

export function StatusBarWordCount() {
	const words = useEditorStore((s) => selectActiveDocument(s)?.words)
	if (words === undefined) return null
	return (
		<span className="statusbar-item">
			{words} {words === 1 ? "word" : "words"}
		</span>
	)
}

export function StatusBarCursor() {
	const cursor = useEditorStore((s) => s.cursor)
	if (!cursor) return null
	return (
		<span className="statusbar-item statusbar-cursor">
			Ln {cursor.line + 1}, Col {cursor.col + 1}
		</span>
	)
}

export function StatusBarModeButton() {
	const mode = useEditorStore((s) => s.mode)
	return (
		<SimpleTooltip label="Cycle editor mode">
			<Button
				variant="ghost"
				size="xs"
				className="statusbar-item statusbar-btn gap-1.5 tracking-normal active:scale-100"
				onClick={() => executeCommand("editor.toggle-mode", { source: "menu" })}
			>
				{MODE_LABELS[mode]}
			</Button>
		</SimpleTooltip>
	)
}

function StatusBarItem({ item }: { item: RegisteredStatusBarItem }) {
	if (item.component) {
		const ItemComponent = item.component as ComponentType
		return <ItemComponent />
	}
	return (
		<SimpleTooltip label={item.tooltip}>
			<Button
				variant="ghost"
				size="xs"
				className="statusbar-item statusbar-btn gap-1.5 tracking-normal active:scale-100"
				onClick={item.onClick}
			>
				{item.icon && <LucideIcon name={item.icon} size={12} />}
				{item.text && <span>{item.text}</span>}
			</Button>
		</SimpleTooltip>
	)
}

export function StatusBar() {
	const statusBarItems = usePluginStore((s) => s.statusBarItems)
	const settingsValues = usePluginStore((s) => s.settingsValues)
	const visibleItems = useMemo(
		() => selectVisibleStatusBarItems({ statusBarItems, settingsValues }),
		[statusBarItems, settingsValues],
	)
	const leftItems = visibleItems.filter((item) => item.position === "left")
	const rightItems = visibleItems.filter((item) => item.position === "right")

	return (
		<div className="app-statusbar">
			<div className="statusbar-left">
				{leftItems.map((item) => (
					<StatusBarItem key={item.key} item={item} />
				))}
			</div>

			<div className="statusbar-sep" />

			<div className="statusbar-right">
				{rightItems.map((item) => (
					<StatusBarItem key={item.key} item={item} />
				))}
			</div>
		</div>
	)
}
