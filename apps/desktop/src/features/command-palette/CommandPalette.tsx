import { type CommandEntry, executeCommand, getCommands } from "@cortex/commands"
import { useUIStore } from "@cortex/core"
import { formatHotkeyDisplay, useHotkeysStore } from "@cortex/hotkeys"
import {
	CommandDialog,
	CommandEmpty,
	CommandFooter,
	CommandFooterHint,
	CommandFooterKey,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@cortex/ui"
import { useCallback, useMemo } from "react"

interface GroupedCommands {
	category: string
	commands: CommandEntry[]
}

const COMMAND_PALETTE_FOOTER_HINTS = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "run" },
	{ keys: ["Esc"], label: "close" },
]

function groupByCategory(commands: CommandEntry[]): GroupedCommands[] {
	const groups = new Map<string, CommandEntry[]>()
	for (const cmd of commands) {
		const existing = groups.get(cmd.category) ?? []
		existing.push(cmd)
		groups.set(cmd.category, existing)
	}
	return Array.from(groups.entries()).map(([category, commands]) => ({ category, commands }))
}

export function CommandPalette() {
	const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
	const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
	const bindings = useHotkeysStore((s) => s.bindings)

	const shortcutMap = useMemo(() => {
		const map = new Map<string, string>()
		for (const binding of bindings) {
			map.set(binding.id, formatHotkeyDisplay(binding.keys))
		}
		return map
	}, [bindings])

	const grouped = commandPaletteOpen ? groupByCategory(getCommands()) : []

	const handleSelect = useCallback(
		(commandId: string) => {
			toggleCommandPalette()
			requestAnimationFrame(() => executeCommand(commandId, { source: "palette" }))
		},
		[toggleCommandPalette],
	)

	return (
		<CommandDialog
			open={commandPaletteOpen}
			onOpenChange={(open) => {
				if (!open) toggleCommandPalette()
			}}
			title="Command Palette"
			description="Search for a command to run..."
			showCloseButton={false}
			commandProps={{ loop: true }}
		>
			<CommandInput autoFocus placeholder="Type a command..." />
			<CommandList className="max-h-[min(420px,60vh)]">
				<CommandEmpty>No commands found</CommandEmpty>
				{grouped.map((group) => (
					<CommandGroup key={group.category} heading={group.category}>
						{group.commands.map((cmd) => {
							const shortcut = cmd.shortcut ?? shortcutMap.get(cmd.id)
							return (
								<CommandItem
									key={cmd.id}
									value={`${cmd.label} ${cmd.category}`}
									onSelect={() => handleSelect(cmd.id)}
								>
									<span className="command-item-copy">
										<span className="command-item-title">{cmd.label}</span>
										<span className="command-item-meta">{cmd.category}</span>
									</span>
									{shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
								</CommandItem>
							)
						})}
					</CommandGroup>
				))}
			</CommandList>
			<CommandFooter>
				{COMMAND_PALETTE_FOOTER_HINTS.map((hint) => (
					<CommandFooterHint key={`${hint.keys.join("-")}-${hint.label}`}>
						{hint.keys.map((key) => (
							<CommandFooterKey key={key}>{key}</CommandFooterKey>
						))}
						{hint.label}
					</CommandFooterHint>
				))}
			</CommandFooter>
		</CommandDialog>
	)
}
