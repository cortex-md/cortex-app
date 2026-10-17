import {
	type CommandEntry,
	commandRegistry,
	executeCommand,
	resolveRecentCommands,
} from "@cortex/commands"
import { formatHotkeyDisplay, useHotkeysStore } from "@cortex/commands/hotkeys"
import { useUIStore } from "@cortex/core"
import type { SearchMatchRange } from "@cortex/search"
import {
	CommandDialog,
	CommandFooterHints,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
	Kbd,
} from "@cortex/ui"
import { SearchIcon, SquareTerminalIcon } from "lucide-react"
import {
	type KeyboardEvent,
	memo,
	useCallback,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react"
import {
	type CommandPaletteRequest,
	commandPaletteModal,
	openQuickFinderFromCommandPalette,
	toggleCommandPalette,
} from "@/utils/modals"
import { HighlightedText } from "../search/HighlightedSnippet"
import { matchCommand } from "./matchCommand"

interface PaletteRow {
	command: CommandEntry
	labelRanges: readonly SearchMatchRange[]
}

interface PaletteGroup {
	heading: string
	rows: PaletteRow[]
	showCategory: boolean
}

const RESULT_LIMIT = 40
const RECENT_LIMIT = 3
const QUICK_FINDER_COMMAND_ID = "navigate.quick-finder"
const SEARCH_NOTES_VALUE = "palette:search-notes"
const SUGGESTED_COMMAND_IDS = [
	QUICK_FINDER_COMMAND_ID,
	"view.search",
	"view.toggle-sidebar",
	"app.settings",
] as const

function subscribeRegistry(listener: () => void): () => void {
	return commandRegistry.subscribe(listener)
}

function getRegistrySnapshot() {
	return commandRegistry.getSnapshot()
}

function toRows(commands: readonly CommandEntry[]): PaletteRow[] {
	return commands.map((command) => ({ command, labelRanges: [] }))
}

function buildIdleGroups(
	commands: readonly CommandEntry[],
	recentCommandIds: readonly string[],
): PaletteGroup[] {
	const recent = resolveRecentCommands(recentCommandIds, commands, RECENT_LIMIT)
	const recentIds = new Set(recent.map((command) => command.id))
	const suggested = resolveRecentCommands(
		SUGGESTED_COMMAND_IDS,
		commands,
		SUGGESTED_COMMAND_IDS.length,
	).filter((command) => !recentIds.has(command.id))
	return [
		{ heading: "Recent", rows: toRows(recent), showCategory: true },
		{ heading: "Suggested", rows: toRows(suggested), showCategory: true },
	].filter((group) => group.rows.length > 0)
}

function buildQueryGroups(commands: readonly CommandEntry[], query: string): PaletteGroup[] {
	const scored: (PaletteRow & { score: number })[] = []
	for (const command of commands) {
		const match = matchCommand(command, query)
		if (match) scored.push({ command, labelRanges: match.labelRanges, score: match.score })
	}
	scored.sort((left, right) => right.score - left.score)
	const groups = new Map<string, PaletteGroup>()
	for (const row of scored.slice(0, RESULT_LIMIT)) {
		const heading = row.command.category
		const group = groups.get(heading) ?? { heading, rows: [], showCategory: false }
		group.rows.push(row)
		groups.set(heading, group)
	}
	return Array.from(groups.values())
}

const CommandPaletteRows = memo(function CommandPaletteRows({
	groups,
	shortcutMap,
	onSelect,
}: {
	groups: PaletteGroup[]
	shortcutMap: ReadonlyMap<string, string>
	onSelect: (commandId: string) => void
}) {
	return groups.map((group) => (
		<CommandGroup key={group.heading} heading={group.heading}>
			{group.rows.map(({ command, labelRanges }) => {
				const shortcut = shortcutMap.get(command.id)
				return (
					<CommandItem key={command.id} value={command.id} onSelect={onSelect}>
						<span className="command-item-title">
							<HighlightedText text={command.label} ranges={labelRanges} />
						</span>
						{group.showCategory && (
							<span className="command-item-category">{command.category}</span>
						)}
						{shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
					</CommandItem>
				)
			})}
		</CommandGroup>
	))
})

function CommandPaletteNoMatch({
	query,
	onSearchNotes,
}: {
	query: string
	onSearchNotes: () => void
}) {
	return (
		<div className="command-none">
			<strong>No commands match “{query}”</strong>
			<span>Try fewer letters, or search notes instead.</span>
			<CommandItem value={SEARCH_NOTES_VALUE} onSelect={onSearchNotes}>
				<SearchIcon aria-hidden="true" />
				<span className="command-item-title">Search notes for “{query}”</span>
				<CommandShortcut>{formatHotkeyDisplay("mod+enter")}</CommandShortcut>
			</CommandItem>
		</div>
	)
}

export function CommandPalette() {
	const request = commandPaletteModal.useTarget()
	if (!request) return null
	return <CommandPaletteDialog request={request} />
}

function CommandPaletteDialog({ request }: { request: CommandPaletteRequest }) {
	const bindings = useHotkeysStore((state) => state.bindings)
	const recentCommandIds = useUIStore((state) => state.recentCommandIds)
	const snapshot = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot)
	const [query, setQuery] = useState(() => request.query)
	const trimmedQuery = query.trim()

	const shortcutMap = useMemo(() => {
		const map = new Map<string, string>()
		for (const binding of bindings) {
			if (binding.enabled && binding.keys) map.set(binding.id, formatHotkeyDisplay(binding.keys))
		}
		return map
	}, [bindings])

	const groups = useMemo(
		() =>
			trimmedQuery
				? buildQueryGroups(snapshot.commands, trimmedQuery)
				: buildIdleGroups(snapshot.commands, recentCommandIds),
		[recentCommandIds, snapshot, trimmedQuery],
	)
	const hasMatches = groups.length > 0

	const footerHints = useMemo(() => {
		const quickFinderShortcut = shortcutMap.get(QUICK_FINDER_COMMAND_ID)
		return [
			{ keys: ["↵"], label: "Run" },
			{ keys: ["↑", "↓"], label: "Move" },
			...(quickFinderShortcut
				? [{ keys: [quickFinderShortcut], label: "Find notes", align: "end" as const }]
				: []),
		]
	}, [shortcutMap])

	const handleSelect = useCallback((commandId: string) => {
		toggleCommandPalette()
		useUIStore.getState().recordRecentCommand(commandId)
		requestAnimationFrame(() => executeCommand(commandId, { source: "palette" }))
	}, [])

	const handleSearchNotes = useCallback(
		() => openQuickFinderFromCommandPalette(trimmedQuery),
		[trimmedQuery],
	)

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || hasMatches) return
			if (!trimmedQuery) return
			event.preventDefault()
			handleSearchNotes()
		},
		[handleSearchNotes, hasMatches, trimmedQuery],
	)

	return (
		<CommandDialog
			open
			onOpenChange={(open) => {
				if (!open) toggleCommandPalette()
			}}
			title="Command Palette"
			description="Search for a command to run"
			className="command-palette-dialog"
			showCloseButton={false}
			commandProps={{ loop: true, shouldFilter: false, onKeyDown: handleKeyDown }}
		>
			<CommandInput
				autoFocus
				icon={SquareTerminalIcon}
				placeholder="Run a command"
				aria-label="Run a command"
				value={query}
				onValueChange={setQuery}
				trailing={<Kbd>Esc</Kbd>}
			/>
			<CommandList className="command-palette-list">
				{hasMatches ? (
					<CommandPaletteRows groups={groups} shortcutMap={shortcutMap} onSelect={handleSelect} />
				) : trimmedQuery ? (
					<CommandPaletteNoMatch query={trimmedQuery} onSearchNotes={handleSearchNotes} />
				) : null}
			</CommandList>
			<CommandFooterHints hints={footerHints} />
		</CommandDialog>
	)
}
