import { executeCommand } from "@cortex/commands"
import { Button, SimpleTooltip } from "@cortex/ui"
import { CommandIcon, type LucideIcon, Maximize2Icon, SearchIcon, SettingsIcon } from "lucide-react"
import { useCommandHotkey } from "../../hooks/useCommandHotkey"

interface WritingModeAction {
	id: string
	label: string
	icon: LucideIcon
	run: () => void
}

const WRITING_MODE_ACTIONS: WritingModeAction[] = [
	{
		id: "navigate.quick-finder",
		label: "Find a note",
		icon: SearchIcon,
		run: () => executeCommand("navigate.quick-finder", { source: "menu" }),
	},
	{
		id: "navigate.command-palette",
		label: "Run a command",
		icon: CommandIcon,
		run: () => executeCommand("navigate.command-palette", { source: "menu" }),
	},
	{
		id: "app.settings",
		label: "Settings",
		icon: SettingsIcon,
		run: () => executeCommand("app.settings", { source: "menu" }),
	},
	{
		id: "view.toggle-writing-mode",
		label: "Exit writing mode",
		icon: Maximize2Icon,
		run: () => executeCommand("view.toggle-writing-mode", { source: "menu" }),
	},
]

function WritingModeActionButton({ action }: { action: WritingModeAction }) {
	const hotkey = useCommandHotkey(action.id)
	const Icon = action.icon
	return (
		<SimpleTooltip label={action.label} shortcut={hotkey ?? undefined} side="bottom">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="writing-mode-toolbar-button"
				aria-label={action.label}
				onClick={action.run}
			>
				<Icon size={16} strokeWidth={2} />
			</Button>
		</SimpleTooltip>
	)
}

export function WritingModeToolbar() {
	return (
		<nav className="writing-mode-toolbar" aria-label="Writing mode actions">
			{WRITING_MODE_ACTIONS.map((action) => (
				<WritingModeActionButton key={action.id} action={action} />
			))}
		</nav>
	)
}
