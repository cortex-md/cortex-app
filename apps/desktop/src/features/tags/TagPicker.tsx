import { useEditorStore, useTagsStore, useUIStore, useVaultStore } from "@cortex/core"
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
	Input,
} from "@cortex/ui"
import { useCallback, useMemo, useState } from "react"

const emptyTags: string[] = []
const TAG_PICKER_FOOTER_HINTS = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "toggle" },
	{ keys: ["Esc"], label: "close" },
]

export function TagPicker() {
	const tagPickerOpen = useUIStore((s) => s.tagPickerOpen)
	const toggleTagPicker = useUIStore((s) => s.toggleTagPicker)
	const activeFilePath = useEditorStore((s) => s.activeFilePath)
	const vault = useVaultStore((s) => s.vault)
	const tagIndex = useTagsStore((s) => s.tagIndex)
	const tagColors = useTagsStore((s) => s.tagColors)
	const currentTags = useTagsStore((s) =>
		activeFilePath ? (s.fileTags[activeFilePath] ?? emptyTags) : emptyTags,
	)
	const setTagColor = useTagsStore((s) => s.setTagColor)
	const addTagToFile = useTagsStore((s) => s.addTagToFile)
	const removeTagFromFile = useTagsStore((s) => s.removeTagFromFile)
	const [inputValue, setInputValue] = useState("")
	const [editingColorFor, setEditingColorFor] = useState<string | null>(null)

	const allTags = useMemo(
		() =>
			Object.entries(tagIndex)
				.map(([tag, filePaths]) => ({
					tag,
					color: tagColors[tag] ?? null,
					filePaths,
				}))
				.sort((a, b) => b.filePaths.length - a.filePaths.length || a.tag.localeCompare(b.tag)),
		[tagColors, tagIndex],
	)

	const closeModal = useCallback(() => {
		toggleTagPicker()
		setInputValue("")
		setEditingColorFor(null)
	}, [toggleTagPicker])

	const handleToggleTag = useCallback(
		async (tag: string) => {
			if (!activeFilePath) return
			if (currentTags.includes(tag)) {
				await removeTagFromFile(activeFilePath, tag)
			} else {
				await addTagToFile(activeFilePath, tag)
			}
		},
		[activeFilePath, currentTags, addTagToFile, removeTagFromFile],
	)

	const handleCreateTag = useCallback(async () => {
		if (!activeFilePath || !inputValue.trim()) return
		const newTag = inputValue.trim().toLowerCase()
		await addTagToFile(activeFilePath, newTag)
		setInputValue("")
		closeModal()
	}, [activeFilePath, inputValue, addTagToFile, closeModal])

	const handleColorChange = useCallback(
		(tag: string, color: string) => {
			if (!vault) return
			setTagColor(vault.path, tag, color || null)
		},
		[vault, setTagColor],
	)

	if (!activeFilePath) return null

	const inputMatchesExisting = allTags.some(
		(t) => t.tag.toLowerCase() === inputValue.trim().toLowerCase(),
	)

	return (
		<CommandDialog
			open={tagPickerOpen}
			onOpenChange={(open) => {
				if (!open) closeModal()
			}}
			title="Tag Picker"
			description="Add or remove tags from the current note"
			showCloseButton={false}
		>
			<CommandInput
				placeholder="Search or create tag..."
				value={inputValue}
				onValueChange={setInputValue}
			/>
			<CommandList>
				<CommandEmpty className="py-4">
					{inputValue.trim() && !inputMatchesExisting ? (
						<button
							type="button"
							className="mx-auto flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-brand transition-[background-color,color] duration-150 ease-out hover:bg-muted/55 hover:text-brand/80"
							onClick={handleCreateTag}
						>
							Create tag "{inputValue.trim()}"
						</button>
					) : (
						<span className="text-sm text-muted-foreground">No tags found</span>
					)}
				</CommandEmpty>

				{inputValue.trim() && !inputMatchesExisting && allTags.length > 0 && (
					<CommandGroup>
						<CommandItem onSelect={handleCreateTag} value={`create:${inputValue}`}>
							<span className="command-item-copy">
								<span className="command-item-title">Create tag "{inputValue.trim()}"</span>
								<span className="command-item-meta">Add it to the current note</span>
							</span>
						</CommandItem>
					</CommandGroup>
				)}

				{allTags.length > 0 && (
					<CommandGroup heading="Tags">
						{allTags.map((entry) => {
							const isActive = currentTags.includes(entry.tag)
							return (
								<CommandItem
									key={entry.tag}
									value={entry.tag}
									onSelect={() => handleToggleTag(entry.tag)}
								>
									<span className="command-item-copy">
										<span className="command-item-title">{entry.tag}</span>
										<span className="command-item-meta">
											{entry.filePaths.length} {entry.filePaths.length === 1 ? "note" : "notes"}
										</span>
									</span>
									<button
										type="button"
										aria-label={`Set color for ${entry.tag}`}
										className="tag-picker-color-button"
										style={{ backgroundColor: entry.color ?? "transparent" }}
										title="Set tag color"
										onClick={(e) => {
											e.stopPropagation()
											setEditingColorFor(editingColorFor === entry.tag ? null : entry.tag)
										}}
									/>
									{isActive && <CommandShortcut>Added</CommandShortcut>}
								</CommandItem>
							)
						})}
					</CommandGroup>
				)}
			</CommandList>
			{editingColorFor && (
				<div className="command-inline-panel flex items-center gap-2 px-4 py-2">
					<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
						Color for {editingColorFor}
					</span>
					<Input
						type="color"
						value={tagColors[editingColorFor] ?? "#fb7185"}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
							handleColorChange(editingColorFor, e.target.value)
						}
						className="h-7 w-8 rounded-[6px] border-none p-0"
					/>
					<button
						type="button"
						className="rounded-[6px] px-2 py-1 text-xs text-muted-foreground transition-[background-color,color] duration-150 ease-out hover:bg-muted/60 hover:text-text-primary"
						onClick={() => {
							if (vault) setTagColor(vault.path, editingColorFor, null)
							setEditingColorFor(null)
						}}
					>
						Clear
					</button>
				</div>
			)}
			<CommandFooter>
				{TAG_PICKER_FOOTER_HINTS.map((hint) => (
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
