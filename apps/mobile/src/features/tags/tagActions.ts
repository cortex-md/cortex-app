import { getErrorMessage, useTagsStore } from "@cortex/core"
import { Alert } from "react-native"

import { toast } from "@/features/feedback/useToast"
import type { TagColorOption } from "@/features/tags/tagColors"

export function getTagNameError(value: string): string | null {
	const name = value.trim().replace(/^#/, "")
	if (!name) return "Enter a tag name"
	if (/\s/.test(name)) return "Tags can't contain spaces"
	if (name.startsWith("/") || name.endsWith("/") || name.includes("//")) {
		return "Use / only between nested tag names"
	}
	return null
}

export async function renameTagInVault(
	vaultPath: string,
	tag: string,
	value: string,
): Promise<string | null> {
	const nextTag = value.trim().replace(/^#/, "")
	if (!vaultPath || nextTag === tag) return null
	const error = getTagNameError(nextTag)
	if (error) {
		toast(error)
		return null
	}
	try {
		const count = await useTagsStore.getState().renameTag(vaultPath, tag, nextTag)
		toast(`Renamed #${tag} in ${count} ${count === 1 ? "note" : "notes"}`)
		return nextTag
	} catch (error) {
		toast(getErrorMessage(error))
		return null
	}
}

export function promptRenameTag(
	vaultPath: string,
	tag: string,
	onRenamed?: (nextTag: string) => void,
): void {
	Alert.prompt(
		"Rename tag",
		`Updates #${tag} and its nested tags in every note.`,
		[
			{ style: "cancel", text: "Cancel" },
			{
				onPress: (value?: string) => {
					void renameTagInVault(vaultPath, tag, value ?? "").then((nextTag) => {
						if (nextTag) onRenamed?.(nextTag)
					})
				},
				text: "Rename",
			},
		],
		"plain-text",
		tag,
	)
}

export function setTagColorInVault(vaultPath: string, tag: string, color: string | null): void {
	if (!vaultPath) return
	void useTagsStore
		.getState()
		.setTagColor(vaultPath, tag, color)
		.catch((error: unknown) => toast(getErrorMessage(error)))
}

export interface TagColorChoice {
	key: string
	label: string
	value: string | null
}

export function getTagColorChoices(options: TagColorOption[]): TagColorChoice[] {
	return [...options, { key: "none", label: "No colour", value: null }]
}
