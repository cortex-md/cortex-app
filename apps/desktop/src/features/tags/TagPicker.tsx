import { selectSortedTags, useEditorStore, useTagsStore, useVaultStore } from "@cortex/core"
import {
	Button,
	ColorPicker,
	CommandDialog,
	CommandEmpty,
	CommandFooterHints,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@cortex/ui"
import { useCallback, useState } from "react"
import { formatCount } from "@/utils/format"
import { tagPickerModal, toggleTagPicker } from "@/utils/modals"

const emptyTags: string[] = []
const TAG_PICKER_FOOTER_HINTS = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "toggle" },
	{ keys: ["Esc"], label: "close" },
]

export function TagPicker() {
	const tagPickerOpen = tagPickerModal.useTarget() !== null
	const activeFilePath = useEditorStore((s) => s.activeFilePath)
	if (!tagPickerOpen || !activeFilePath) return null
	return <TagPickerDialog activeFilePath={activeFilePath} />
}

function TagPickerDialog({ activeFilePath }: { activeFilePath: string }) {
	const vault = useVaultStore((s) => s.vault)
	const allTags = useTagsStore(selectSortedTags)
	const tagColors = useTagsStore((s) => s.tagColors)
	const currentTags = useTagsStore((s) => s.fileTags[activeFilePath] ?? emptyTags)
	const setTagColor = useTagsStore((s) => s.setTagColor)
	const addTagToFile = useTagsStore((s) => s.addTagToFile)
	const removeTagFromFile = useTagsStore((s) => s.removeTagFromFile)
	const [inputValue, setInputValue] = useState("")
	const [editingColorFor, setEditingColorFor] = useState<string | null>(null)

	const closeModal = toggleTagPicker

	const handleToggleTag = useCallback(
		async (tag: string) => {
			if (currentTags.includes(tag)) {
				await removeTagFromFile(activeFilePath, tag)
			} else {
				await addTagToFile(activeFilePath, tag)
			}
		},
		[activeFilePath, currentTags, addTagToFile, removeTagFromFile],
	)

	const handleCreateTag = useCallback(async () => {
		if (!inputValue.trim()) return
		const newTag = inputValue.trim().toLowerCase()
		await addTagToFile(activeFilePath, newTag)
		setInputValue("")
		closeModal()
	}, [activeFilePath, inputValue, addTagToFile])

	const handleColorChange = useCallback(
		(tag: string, color: string | null) => {
			if (!vault) return
			setTagColor(vault.path, tag, color)
			if (!color) setEditingColorFor(null)
		},
		[vault, setTagColor],
	)

	const inputMatchesExisting = allTags.some(
		(t) => t.tag.toLowerCase() === inputValue.trim().toLowerCase(),
	)

	return (
		<CommandDialog
			open
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
						<Button
							size="sm"
							variant="ghost"
							className="mx-auto h-auto gap-2 rounded-[var(--row-radius)] px-3 py-2 text-brand-text hover:text-brand-text active:scale-100"
							onClick={handleCreateTag}
						>
							Create tag "{inputValue.trim()}"
						</Button>
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
											{formatCount(entry.filePaths.length, "note")}
										</span>
									</span>
									<Button
										variant="ghost"
										size="icon-xs"
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
				<div className="command-inline-panel flex flex-col gap-2 px-4 py-2">
					<span className="min-w-0 truncate text-xs text-muted-foreground">
						Color for {editingColorFor}
					</span>
					<ColorPicker
						value={tagColors[editingColorFor] ?? null}
						onChange={(color) => handleColorChange(editingColorFor, color)}
						clearLabel="Clear"
					/>
				</div>
			)}
			<CommandFooterHints hints={TAG_PICKER_FOOTER_HINTS} />
		</CommandDialog>
	)
}
