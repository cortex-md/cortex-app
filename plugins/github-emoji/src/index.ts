import type { ViewDescriptor, ViewDispatch, ViewState } from "@cortex.md/api"
import { CortexPlugin } from "@cortex.md/api"
import { EMOJI_CATEGORIES, GITHUB_EMOJI_MAP } from "./emojiMap"

const EMOJI_COUNT = Object.keys(GITHUB_EMOJI_MAP).length

interface EmojiViewState {
	searchQuery: string
	activeCategory: string
	recentEmojis: string[]
}

const INITIAL_STATE: EmojiViewState = {
	searchQuery: "",
	activeCategory: "Smileys",
	recentEmojis: [],
}

function reduceEmojiView(
	state: Record<string, unknown>,
	action: string,
	payload?: unknown,
): Record<string, unknown> {
	const current = state as unknown as EmojiViewState
	switch (action) {
		case "set-search":
			return { ...state, searchQuery: payload as string }
		case "set-category":
			return { ...state, searchQuery: "", activeCategory: payload as string }
		case "track-recent": {
			const code = payload as string
			const recentEmojis = [
				code,
				...current.recentEmojis.filter((recent) => recent !== code),
			].slice(0, 12)
			return { ...state, recentEmojis }
		}
		default:
			return state
	}
}

function renderEmojiView(viewState: ViewState, _dispatch: ViewDispatch): ViewDescriptor {
	const state = viewState.state as unknown as EmojiViewState
	const { searchQuery, activeCategory } = state
	const categoryNames = Object.keys(EMOJI_CATEGORIES)

	const emojiCodes =
		searchQuery.length > 0
			? Object.keys(GITHUB_EMOJI_MAP).filter((code) => code.includes(searchQuery.toLowerCase()))
			: (EMOJI_CATEGORIES[activeCategory] ?? [])

	const categoryButtons: ViewDescriptor = categoryNames.map((name) => ({
		type: "button",
		key: name,
		label: `${GITHUB_EMOJI_MAP[EMOJI_CATEGORIES[name][0]] ?? "📁"} ${name}`,
		action: "set-category",
		payload: name,
		variant: name === activeCategory && !searchQuery ? "primary" : "ghost",
	}))

	const emojiListItems: ViewDescriptor = emojiCodes.slice(0, 60).map((code) => ({
		type: "item",
		key: code,
		title: `${GITHUB_EMOJI_MAP[code]} :${code}:`,
		action: "track-recent",
		payload: code,
	}))

	const recentSection: ViewDescriptor =
		state.recentEmojis.length > 0
			? [
					{
						type: "text",
						value: "Recently used",
						tone: "muted",
						weight: "medium",
					},
					{
						type: "row",
						wrap: true,
						gap: "xs",
						children: state.recentEmojis.map((code) => ({
							type: "badge",
							key: code,
							value: `${GITHUB_EMOJI_MAP[code]} :${code}:`,
						})),
					},
				]
			: []

	return [
		{
			type: "heading",
			value: `GitHub Emoji (${EMOJI_COUNT})`,
		},
		{
			type: "input",
			inputType: "search",
			label: "Search emojis",
			placeholder: "Search emojis... (e.g. rocket, heart, fire)",
			value: searchQuery,
			action: "set-search",
		},
		...recentSection,
		{
			type: "text",
			value: searchQuery ? `Results for "${searchQuery}" (${emojiCodes.length})` : activeCategory,
			tone: "muted",
			weight: "medium",
		},
		{
			type: "scroll-area",
			size: "md",
			children: {
				type: "stack",
				gap: "xs",
				children: emojiListItems,
			},
		},
		{
			type: "separator",
		},
		{
			type: "text",
			value: "Categories",
			tone: "muted",
			weight: "medium",
		},
		{
			type: "scroll-area",
			size: "fill",
			children: {
				type: "stack",
				gap: "xs",
				children: categoryButtons,
			},
		},
	]
}

export default class GitHubEmojiPlugin extends CortexPlugin {
	onload() {
		this.registerMarkdownInline({
			id: "github-emoji",
			pattern: ":([a-z0-9_+-]+):",
			flags: "gi",
			replacement: {
				type: "text",
				content: (match) => GITHUB_EMOJI_MAP[match[1].toLowerCase()] ?? match[0],
			},
		})

		this.addCommand({
			id: "insert-emoji",
			label: "Insert Emoji",
			icon: "smile",
			defaultHotkey: "mod+shift+e",
			execute: () => {
				this.api.editor.insertAtCursor(":rocket: ")
			},
		})

		this.addCommand({
			id: "emoji-reference",
			label: "Emoji Quick Reference",
			icon: "book-open",
			category: "Emoji",
			execute: () => {
				const topEmojis = ["rocket", "fire", "sparkles", "heart", "star", "tada", "100"]
				const reference = topEmojis
					.map((code) => `:${code}: → ${GITHUB_EMOJI_MAP[code]}`)
					.join("  ")
				this.api.editor.insertAtCursor(reference)
			},
		})

		this.registerStatusBarItem({
			id: "emoji-status",
			position: "right",
			icon: "smile",
			text: `${EMOJI_COUNT} emojis`,
			tooltip: "GitHub Emoji Plugin active",
		})

		this.registerSettingsTab({
			id: "github-emoji",
			label: "Emoji",
			icon: "smile",
			settings: [
				{
					key: "livePreview",
					label: "Live Preview",
					description: "Replace :emoji_code: with emoji characters in the editor",
					type: "boolean",
					default: true,
					onChange: () => this.api.ui.showNotice("Restart editor to apply live preview changes"),
				},
				{
					key: "emojiSize",
					label: "Emoji Size",
					description: "Display size of emojis in the editor",
					type: "select",
					default: "normal",
					options: [
						{ value: "small", label: "Small" },
						{ value: "normal", label: "Normal" },
						{ value: "large", label: "Large" },
					],
				},
				{
					key: "skinTone",
					label: "Default Skin Tone",
					description: "Preferred skin tone for supported emojis",
					type: "select",
					default: "default",
					options: [
						{ value: "default", label: "Default (Yellow)" },
						{ value: "light", label: "Light" },
						{ value: "medium-light", label: "Medium Light" },
						{ value: "medium", label: "Medium" },
						{ value: "medium-dark", label: "Medium Dark" },
						{ value: "dark", label: "Dark" },
					],
				},
				{
					key: "showInStatusBar",
					label: "Status Bar Indicator",
					description: "Show emoji plugin indicator in the status bar",
					type: "boolean",
					default: true,
				},
			],
		})

		this.registerView({
			id: "emoji-browser",
			label: "Emoji Browser",
			icon: "smile",
			location: "sidebar-left",
			initialState: INITIAL_STATE as unknown as Record<string, unknown>,
			reduce: reduceEmojiView,
			render: renderEmojiView,
		})

		this.registerSidebarItem({
			id: "emoji-browser",
			label: "Emoji",
			icon: "smile",
			viewId: "emoji-browser",
		})
	}
}
