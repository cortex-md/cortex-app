import { useTagsStore, useVaultStore } from "@cortex/core"
import {
	ColorPicker,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui"
import { useCallback, useMemo, useState } from "react"
import { TagChipList } from "../TagChipList"
import { getTagsFromPropertyValue } from "../tagsValue"
import type { PropertyValueEditorProps } from "../types"

const regexpSpecialCharacters = /[.*+?^${}()|[\]\\]/g

function normalizeTagInput(value: string): string {
	return value.trim().replace(/^#+/, "").trim().toLowerCase()
}

function escapeRegExp(value: string): string {
	return value.replace(regexpSpecialCharacters, "\\$&")
}

export function TagsValueEditor({ definition, filePath, value }: PropertyValueEditorProps) {
	const vault = useVaultStore((state) => state.vault)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const setTagColor = useTagsStore((state) => state.setTagColor)
	const setTagsForFile = useTagsStore((state) => state.setTagsForFile)
	const valueTags = useMemo(() => getTagsFromPropertyValue(value), [value])
	const valueTagKey = useMemo(() => valueTags.join("\u0000"), [valueTags])
	const [query, setQuery] = useState("")
	const [optimisticTags, setOptimisticTags] = useState<{
		sourceKey: string
		tags: string[]
	} | null>(null)
	const [editingColorFor, setEditingColorFor] = useState<string | null>(null)
	const tags = optimisticTags?.sourceKey === valueTagKey ? optimisticTags.tags : valueTags
	const tagSet = useMemo(() => new Set(tags.map((tag) => tag.toLowerCase())), [tags])

	const commitTags = useCallback(
		async (nextTags: string[]) => {
			setOptimisticTags({ sourceKey: valueTagKey, tags: nextTags })
			try {
				await setTagsForFile(filePath, nextTags)
			} catch (error) {
				setOptimisticTags(null)
				throw error
			}
		},
		[filePath, setTagsForFile, valueTagKey],
	)

	const removeTag = useCallback(
		(tag: string) => {
			setEditingColorFor((currentTag) =>
				currentTag?.toLowerCase() === tag.toLowerCase() ? null : currentTag,
			)
			void commitTags(tags.filter((currentTag) => currentTag.toLowerCase() !== tag.toLowerCase()))
		},
		[commitTags, tags],
	)

	const addTag = useCallback(
		(tag: string) => {
			const normalizedTag = normalizeTagInput(tag)
			if (!normalizedTag || tagSet.has(normalizedTag)) return
			void commitTags([...tags, normalizedTag]).then(() => setQuery(""))
		},
		[commitTags, tagSet, tags],
	)
	const toggleEditingColorFor = useCallback((tag: string) => {
		setEditingColorFor((currentTag) => (currentTag === tag ? null : tag))
	}, [])
	const handleTagColorChange = useCallback(
		(color: string | null) => {
			if (!vault || !editingColorFor) return
			void setTagColor(vault.path, editingColorFor.toLowerCase(), color)
		},
		[editingColorFor, setTagColor, vault],
	)

	const normalizedQuery = normalizeTagInput(query)
	const normalizedQueryMatcher = useMemo(
		() => (normalizedQuery ? new RegExp(escapeRegExp(normalizedQuery)) : null),
		[normalizedQuery],
	)
	const tagSuggestions = useMemo(() => {
		const suggestions: [string, string[]][] = []
		for (const [tag, filePaths] of Object.entries(tagIndex)) {
			if (tagSet.has(tag.toLowerCase())) continue
			if (normalizedQueryMatcher && !normalizedQueryMatcher.test(tag)) continue
			suggestions.push([tag, filePaths])
		}
		return suggestions
			.sort(
				([firstTag, firstPaths], [secondTag, secondPaths]) =>
					secondPaths.length - firstPaths.length || firstTag.localeCompare(secondTag),
			)
			.slice(0, 24)
	}, [normalizedQueryMatcher, tagIndex, tagSet])
	const canCreateTag =
		Boolean(normalizedQuery) &&
		!tagSet.has(normalizedQuery) &&
		!Object.hasOwn(tagIndex, normalizedQuery)

	return (
		<Command shouldFilter={false} className="note-property-command note-property-tags-command">
			<div className="note-property-tags-editor-value">
				<TagChipList
					tags={tags}
					editingColorFor={editingColorFor}
					onEditTagColor={vault ? toggleEditingColorFor : undefined}
					onRemoveTag={removeTag}
				/>
			</div>
			{editingColorFor && (
				<div className="note-property-tag-color-panel">
					<div className="note-property-tag-color-heading">
						Color for <strong>{editingColorFor}</strong>
					</div>
					<ColorPicker
						value={tagColors[editingColorFor] ?? tagColors[editingColorFor.toLowerCase()] ?? null}
						onChange={handleTagColorChange}
						customInputId={`tag-color-${definition.id}-${editingColorFor}`}
					/>
				</div>
			)}
			<CommandInput autoFocus placeholder="Add tag..." value={query} onValueChange={setQuery} />
			<CommandList>
				{canCreateTag && (
					<CommandGroup heading="Create">
						<CommandItem value={`create ${normalizedQuery}`} onSelect={() => addTag(query)}>
							<span>{normalizedQuery}</span>
							<small>Enter to add</small>
						</CommandItem>
					</CommandGroup>
				)}
				{tagSuggestions.length > 0 && (
					<CommandGroup heading="Tags">
						{tagSuggestions.map(([tag, filePaths]) => (
							<CommandItem key={tag} value={tag} onSelect={() => addTag(tag)}>
								<span>{tag}</span>
								<small>{filePaths.length}</small>
							</CommandItem>
						))}
					</CommandGroup>
				)}
				<CommandEmpty>No tags found</CommandEmpty>
			</CommandList>
		</Command>
	)
}
