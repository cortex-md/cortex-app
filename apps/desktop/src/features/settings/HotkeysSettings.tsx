import { commandRegistry } from "@cortex/commands"
import { formatHotkeyDisplay, type HotkeyBinding, useHotkeysStore } from "@cortex/commands/hotkeys"
import { useVaultStore } from "@cortex/core"
import { Button, InputGroup, InputGroupAddon, InputGroupInput, Kbd } from "@cortex/ui"
import { RotateCcwIcon, SearchIcon } from "lucide-react"
import {
	memo,
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsGroupContent,
	SettingsList,
	SettingsListItem,
	SettingsPage,
	SettingsSection,
} from "./SettingsPrimitives"

function HotkeyRecorder({
	currentKeys,
	onRecord,
}: {
	currentKeys: string
	onRecord: (keys: string) => void
}) {
	const [recording, setRecording] = useState(false)
	const recorderRef = useRef<HTMLButtonElement>(null)
	const hasKeys = currentKeys.trim().length > 0
	const handleRecordEvent = useEffectEvent((keys: string) => {
		onRecord(keys)
	})

	useEffect(() => {
		if (!recording) return

		const handleKeyDown = (e: KeyboardEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (e.key === "Escape") {
				setRecording(false)
				return
			}

			const parts: string[] = []
			if (e.metaKey || e.ctrlKey) parts.push("mod")
			if (e.shiftKey) parts.push("shift")
			if (e.altKey) parts.push("alt")

			const key = e.key.toLowerCase()
			if (!["control", "shift", "alt", "meta"].includes(key)) {
				parts.push(key === " " ? "space" : key)
				const hotkeyString = parts.join("+")
				handleRecordEvent(hotkeyString)
				setRecording(false)
			}
		}

		window.addEventListener("keydown", handleKeyDown, true)
		return () => window.removeEventListener("keydown", handleKeyDown, true)
	}, [recording])

	if (recording) {
		return (
			<Button
				ref={recorderRef}
				variant="outline"
				className="min-w-[100px] text-xs text-brand border-brand/50 animate-pulse"
				onClick={() => setRecording(false)}
			>
				Press keys...
			</Button>
		)
	}

	return (
		<Button
			aria-label={hasKeys ? "Change shortcut" : "Add shortcut"}
			variant="outline"
			className="min-w-[100px] text-xs"
			onClick={() => setRecording(true)}
		>
			{hasKeys ? (
				<Kbd className="text-[10px]">{formatHotkeyDisplay(currentKeys)}</Kbd>
			) : (
				<span className="text-muted-foreground">Unassigned</span>
			)}
		</Button>
	)
}

function subscribeCommandRegistry(callback: () => void): () => void {
	return commandRegistry.subscribe(callback)
}

function getCommandRegistryVersion(): number {
	return commandRegistry.getSnapshot().version
}

interface HotkeyRowProps {
	binding: HotkeyBinding
	vimCommandName?: string
	onRecord: (id: string, keys: string) => void
	onReset: (id: string) => void
}

const HotkeyRow = memo(function HotkeyRow({
	binding,
	vimCommandName,
	onRecord,
	onReset,
}: HotkeyRowProps) {
	return (
		<SettingsListItem className="justify-between hover:bg-bg-hover">
			<span className="flex min-w-0 flex-col gap-1">
				<span className="text-sm text-text-primary">{binding.label}</span>
				{vimCommandName && (
					<span className="font-mono text-xs text-muted-foreground">:{vimCommandName}</span>
				)}
			</span>
			<div className="flex items-center gap-2">
				<HotkeyRecorder
					currentKeys={binding.keys}
					onRecord={(keys) => onRecord(binding.id, keys)}
				/>
				{binding.keys !== binding.defaultKeys && (
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={() => onReset(binding.id)}
						title="Reset to default"
						aria-label="Reset to default"
					>
						<RotateCcwIcon />
					</Button>
				)}
			</div>
		</SettingsListItem>
	)
})

export function HotkeysSection() {
	const bindings = useHotkeysStore((state) => state.bindings)
	const updateBinding = useHotkeysStore((state) => state.updateBinding)
	const resetBinding = useHotkeysStore((state) => state.resetBinding)
	const resetAll = useHotkeysStore((state) => state.resetAll)
	const saveOverrides = useHotkeysStore((state) => state.saveOverrides)
	const vault = useVaultStore((s) => s.vault)
	const pendingSave = useRef(false)
	const [searchQuery, setSearchQuery] = useState("")
	const commandRegistryVersion = useSyncExternalStore(
		subscribeCommandRegistry,
		getCommandRegistryVersion,
		getCommandRegistryVersion,
	)

	const handleRecord = useCallback(
		(id: string, keys: string) => {
			updateBinding(id, keys)
			pendingSave.current = true
		},
		[updateBinding],
	)

	const handleReset = useCallback(
		(id: string) => {
			resetBinding(id)
			pendingSave.current = true
		},
		[resetBinding],
	)

	const handleResetAll = useCallback(() => {
		resetAll()
		pendingSave.current = true
	}, [resetAll])

	// biome-ignore lint/correctness/useExhaustiveDependencies: save when bindings change
	useEffect(() => {
		if (!pendingSave.current || !vault) return
		pendingSave.current = false
		saveOverrides(vault.path)
	}, [bindings, vault, saveOverrides])

	const vimCommandNames = useMemo(() => {
		void commandRegistryVersion
		const names = new Map<string, string>()
		for (const choice of commandRegistry.getVimChoices()) {
			if (!choice.isPrimary || names.has(choice.commandId)) continue
			names.set(choice.commandId, choice.name)
		}
		return names
	}, [commandRegistryVersion])

	const filtered = useMemo(() => {
		const query = searchQuery.toLowerCase().trim()
		return bindings.filter((binding) => {
			if (binding.category === "QuickFinder") return false
			if (!query) return true
			const vimCommandName = vimCommandNames.get(binding.id)
			const labelMatch = binding.label.toLowerCase().includes(query)
			const categoryMatch = binding.category.toLowerCase().includes(query)
			const keysMatch = binding.keys.toLowerCase().includes(query)
			const displayMatch = formatHotkeyDisplay(binding.keys).toLowerCase().includes(query)
			const vimMatch = vimCommandName?.toLowerCase().includes(query) ?? false
			return labelMatch || categoryMatch || keysMatch || displayMatch || vimMatch
		})
	}, [bindings, searchQuery, vimCommandNames])

	const grouped = useMemo(() => {
		const groups = new Map<string, HotkeyBinding[]>()
		for (const binding of filtered) {
			const items = groups.get(binding.category)
			if (items) items.push(binding)
			else groups.set(binding.category, [binding])
		}
		return Array.from(groups, ([category, items]) => ({ category, items }))
	}, [filtered])

	return (
		<SettingsPage>
			<SettingsSection
				title="Keyboard shortcuts"
				description="Search, record, and reset command bindings for this vault."
				action={
					<Button variant="ghost" onClick={handleResetAll}>
						<RotateCcwIcon className="size-3" />
						Reset All
					</Button>
				}
			>
				<SettingsGroup>
					<SettingsGroupContent className="flex flex-col gap-4">
						<InputGroup variant="search">
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
							<InputGroupInput
								placeholder="Search shortcuts..."
								value={searchQuery}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setSearchQuery(e.target.value)
								}
							/>
						</InputGroup>

						{grouped.length === 0 && searchQuery && (
							<SettingsEmptyState className="text-center">
								No shortcuts matching "{searchQuery}"
							</SettingsEmptyState>
						)}

						{grouped.map(({ category, items }) => (
							<div key={category} className="flex flex-col gap-2">
								<h4 className="m-0 text-sm font-medium text-foreground">{category}</h4>
								<SettingsList>
									{items.map((binding) => (
										<HotkeyRow
											key={binding.id}
											binding={binding}
											vimCommandName={vimCommandNames.get(binding.id)}
											onRecord={handleRecord}
											onReset={handleReset}
										/>
									))}
								</SettingsList>
							</div>
						))}
					</SettingsGroupContent>
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
