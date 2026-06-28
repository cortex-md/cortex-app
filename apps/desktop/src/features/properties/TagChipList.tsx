import { useTagsStore } from "@cortex/core"
import { XIcon } from "lucide-react"
import { getTagBadgeStyle } from "./tagsValue"

interface TagChipListProps {
	tags: string[]
	editingColorFor?: string | null
	onEditTagColor?(tag: string): void
	onRemoveTag?(tag: string): void
}

export function TagChipList({
	tags,
	editingColorFor = null,
	onEditTagColor,
	onRemoveTag,
}: TagChipListProps) {
	const tagColors = useTagsStore((state) => state.tagColors)
	if (tags.length === 0) return <span className="note-property-empty">Empty</span>
	return (
		<span className="note-property-tag-list">
			{tags.map((tag) => {
				const color = tagColors[tag] ?? tagColors[tag.toLowerCase()] ?? null
				const colorEditable = Boolean(onEditTagColor)
				return (
					<span
						className="note-property-tag-chip"
						data-has-color={color ? "true" : undefined}
						data-editing-color={editingColorFor === tag ? "true" : undefined}
						key={tag}
						style={getTagBadgeStyle(color)}
					>
						{colorEditable && (
							<button
								type="button"
								className="note-property-tag-color-trigger"
								aria-label={`Change color for ${tag}`}
								onClick={(event) => {
									event.stopPropagation()
									onEditTagColor?.(tag)
								}}
							>
								<span className="note-property-tag-color-dot" />
							</button>
						)}
						<span className="note-property-tag-label">{tag}</span>
						{onRemoveTag && (
							<button
								type="button"
								className="note-property-tag-remove"
								aria-label={`Remove ${tag}`}
								onClick={(event) => {
									event.stopPropagation()
									onRemoveTag(tag)
								}}
							>
								<XIcon />
							</button>
						)}
					</span>
				)
			})}
		</span>
	)
}
