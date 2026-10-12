import { formatMention, MENTION_PATTERN } from "@cortex/comments"
import {
	type SlashCommandItem,
	type SlashCommandMenuState,
	slashCommandExtension,
} from "./slashCommands"
import type { EditorRuntimeExtension, EditorRuntimeModules } from "./types"

export type MentionMenuItem = SlashCommandItem
export type MentionMenuState = SlashCommandMenuState

export interface MentionAutocompleteOptions {
	enabled?: () => boolean
	getItems: () => readonly MentionMenuItem[]
	onStateChange: (state: MentionMenuState | null) => void
}

const MENTION_ITEM_LIMIT = 8

export function mentionAutocompleteExtension(
	runtime: EditorRuntimeModules,
	options: MentionAutocompleteOptions,
): EditorRuntimeExtension {
	return slashCommandExtension(runtime, {
		enabled: options.enabled,
		getItems: options.getItems,
		onStateChange: options.onStateChange,
		onExecuteCommand: () => {},
		itemLimit: MENTION_ITEM_LIMIT,
		trigger: "@",
		insertText: (item) => `${formatMention(item.label)} `,
	})
}

export interface MentionPersonPreview {
	name: string
	detail: string
	initials: string
}

export interface MentionHoverOptions {
	getPerson: (name: string) => MentionPersonPreview | null
}

function createMentionCard(person: MentionPersonPreview): HTMLElement {
	const root = document.createElement("div")
	root.className = "cm-mention-card"
	const avatar = document.createElement("span")
	avatar.className = "cm-mention-card-avatar"
	avatar.textContent = person.initials
	const copy = document.createElement("span")
	copy.className = "cm-mention-card-copy"
	const name = document.createElement("b")
	name.textContent = person.name
	const detail = document.createElement("small")
	detail.textContent = person.detail
	copy.append(name, detail)
	root.append(avatar, copy)
	return root
}

export function mentionHoverExtension(
	runtime: EditorRuntimeModules,
	options: MentionHoverOptions,
): EditorRuntimeExtension {
	const { EditorView, hoverTooltip } = runtime.view
	return [
		hoverTooltip(
			(view, position) => {
				const line = view.state.doc.lineAt(position)
				for (const match of line.text.matchAll(MENTION_PATTERN)) {
					const from = line.from + (match.index ?? 0)
					const to = from + match[0].length
					if (position < from || position > to) continue
					const person = options.getPerson(match[1]?.trim() ?? "")
					if (!person) return null
					return {
						pos: from,
						end: to,
						above: true,
						create: () => ({ dom: createMentionCard(person) }),
					}
				}
				return null
			},
			{ hoverTime: 250 },
		),
		EditorView.baseTheme({
			".cm-tooltip:has(> .cm-mention-card)": {
				border: "0",
				borderRadius: "10px",
				backgroundColor: "var(--bg-elevated)",
				boxShadow: "var(--shadow-popup)",
			},
			".cm-mention-card": {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				padding: "8px 10px",
				fontFamily: "var(--font-ui)",
			},
			".cm-mention-card-avatar": {
				display: "inline-flex",
				width: "24px",
				height: "24px",
				alignItems: "center",
				justifyContent: "center",
				borderRadius: "999px",
				backgroundColor: "var(--accent-subtle)",
				color: "var(--accent-text)",
				fontSize: "10px",
				fontWeight: "600",
			},
			".cm-mention-card-copy": {
				display: "flex",
				flexDirection: "column",
				gap: "1px",
			},
			".cm-mention-card-copy b": {
				color: "var(--text-primary)",
				fontSize: "13px",
				fontWeight: "600",
			},
			".cm-mention-card-copy small": {
				color: "var(--text-muted)",
				fontSize: "11px",
			},
			".cm-mention": {
				cursor: "default",
			},
		}),
	]
}
