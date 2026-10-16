import { type CommandEntry, commandRegistry, executeCommand } from "@cortex/commands"
import { formatHotkeyDisplay, useHotkeysStore } from "@cortex/commands/hotkeys"
import {
	CommandDialog,
	CommandEmpty,
	CommandFooterHints,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@cortex/ui"
import { memo, useCallback, useMemo, useState, useSyncExternalStore } from "react"
import { commandPaletteModal, toggleCommandPalette } from "@/utils/modals"
import { scoreCommand } from "./scoreCommand"

interface GroupedCommands {
	category: string
	commands: CommandEntry[]
}

const RESULT_LIMIT = 40

const COMMAND_PALETTE_FOOTER_HINTS = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "run" },
	{ keys: ["Esc"], label: "close" },
]

function subscribeRegistry(listener: () => void): () => void {
	return commandRegistry.subscribe(listener)
}

function getRegistrySnapshot() {
	return commandRegistry.getSnapshot()
}

function groupByCategory(commands: readonly CommandEntry[]): GroupedCommands[] {
	const groups = new Map<string, CommandEntry[]>()
	for (const cmd of commands) {
		const existing = groups.get(cmd.category) ?? []
		existing.push(cmd)
		groups.set(cmd.category, existing)
	}
	return Array.from(groups.entries()).map(([category, commands]) => ({ category, commands }))
}

function filterCommands(commands: readonly CommandEntry[], query: string): GroupedCommands[] {
	if (!query.trim()) return groupByCategory(commands)
	const scored: { command: CommandEntry; score: number }[] = []
	for (const command of commands) {
		const score = scoreCommand(command, query)
		if (score !== null) scored.push({ command, score })
	}
	scored.sort((left, right) => right.score - left.score)
	return [{ category: "", commands: scored.slice(0, RESULT_LIMIT).map((entry) => entry.command) }]
}

const CommandPaletteRows = memo(function CommandPaletteRows({
	groups,
	shortcutMap,
	onSelect,
}: {
	groups: GroupedCommands[]
	shortcutMap: Map<string, string>
	onSelect: (commandId: string) => void
}) {
	return groups.map((group) => (
		<CommandGroup key={group.category} heading={group.category || undefined}>
			{group.commands.map((cmd) => {
				const shortcut = shortcutMap.get(cmd.id)
				return (
					<CommandItem key={cmd.id} value={cmd.id} onSelect={onSelect}>
						<span className="command-item-copy">
							<span className="command-item-title">{cmd.label}</span>
							<span className="command-item-meta">{cmd.category}</span>
						</span>
						{shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
					</CommandItem>
				)
			})}
		</CommandGroup>
	))
})

export function CommandPalette() {
	const commandPaletteOpen = commandPaletteModal.useTarget() !== null
	const bindings = useHotkeysStore((s) => s.bindings)
	const snapshot = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot)
	const [query, setQuery] = useState("")

	const shortcutMap = useMemo(() => {
		const map = new Map<string, string>()
		for (const binding of bindings) {
			if (binding.enabled && binding.keys) map.set(binding.id, formatHotkeyDisplay(binding.keys))
		}
		return map
	}, [bindings])

	const groups = useMemo(
		() => (commandPaletteOpen ? filterCommands(snapshot.commands, query) : []),
		[commandPaletteOpen, query, snapshot],
	)

	const handleSelect = useCallback((commandId: string) => {
		toggleCommandPalette()
		requestAnimationFrame(() => executeCommand(commandId, { source: "palette" }))
	}, [])

	const handleOpenChange = useCallback((open: boolean) => {
		if (!open) toggleCommandPalette()
		setQuery("")
	}, [])

	return (
		<CommandDialog
			open={commandPaletteOpen}
			onOpenChange={handleOpenChange}
			title="Command Palette"
			description="Search for a command to run..."
			showCloseButton={false}
			commandProps={{ loop: true, shouldFilter: false }}
		>
			<CommandInput
				autoFocus
				placeholder="Type a command..."
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList className="max-h-[min(420px,60vh)]">
				{groups.length === 0 || groups[0]?.commands.length === 0 ? (
					<CommandEmpty>No commands found</CommandEmpty>
				) : (
					<CommandPaletteRows groups={groups} shortcutMap={shortcutMap} onSelect={handleSelect} />
				)}
			</CommandList>
			<CommandFooterHints hints={COMMAND_PALETTE_FOOTER_HINTS} />
		</CommandDialog>
	)
}
