import { definePlugin, type ViewDescriptor, type ViewNode } from "@cortex.md/api"
import { EMOJI_CATEGORIES, GITHUB_EMOJI_MAP } from "./emojiMap"

const EMOJI_COUNT = Object.keys(GITHUB_EMOJI_MAP).length
const CATEGORY_NAMES = Object.keys(EMOJI_CATEGORIES)
const QUICK_REFERENCE = ["rocket", "fire", "sparkles", "heart", "star", "tada", "100"]
	.map((code) => `:${code}: → ${GITHUB_EMOJI_MAP[code]}`)
	.join("  ")

type EmojiBrowserState = {
	searchQuery: string
	activeCategory: string
	recentEmojis: string[]
}

function emojiItem(code: string): ViewNode {
	return {
		type: "item",
		key: code,
		title: `${GITHUB_EMOJI_MAP[code]} :${code}:`,
		action: "insert",
		payload: code,
	}
}

function renderEmojiBrowser({
	searchQuery,
	activeCategory,
	recentEmojis,
}: EmojiBrowserState): ViewDescriptor {
	const query = searchQuery.toLowerCase()
	const emojiCodes = query
		? Object.keys(GITHUB_EMOJI_MAP).filter((code) => code.includes(query))
		: (EMOJI_CATEGORIES[activeCategory] ?? [])

	return [
		{ type: "heading", value: `GitHub Emoji (${EMOJI_COUNT})` },
		{
			type: "input",
			inputType: "search",
			label: "Search emojis",
			placeholder: "Search emojis... (e.g. rocket, heart, fire)",
			value: searchQuery,
			action: "search",
		},
		...(recentEmojis.length > 0
			? ([
					{ type: "text", value: "Recently used", tone: "muted", weight: "medium" },
					{
						type: "row",
						wrap: true,
						gap: "xs",
						children: recentEmojis.map((code) => ({
							type: "button",
							key: code,
							label: GITHUB_EMOJI_MAP[code],
							variant: "ghost",
							size: "sm",
							action: "insert",
							payload: code,
						})),
					},
				] satisfies ViewDescriptor)
			: []),
		{
			type: "text",
			value: query ? `Results for "${searchQuery}" (${emojiCodes.length})` : activeCategory,
			tone: "muted",
			weight: "medium",
		},
		{
			type: "scroll-area",
			size: "md",
			children: { type: "stack", gap: "xs", children: emojiCodes.slice(0, 60).map(emojiItem) },
		},
		{ type: "separator" },
		{ type: "text", value: "Categories", tone: "muted", weight: "medium" },
		{
			type: "scroll-area",
			size: "fill",
			children: {
				type: "stack",
				gap: "xs",
				children: CATEGORY_NAMES.map((name) => ({
					type: "button",
					key: name,
					label: `${GITHUB_EMOJI_MAP[EMOJI_CATEGORIES[name][0]] ?? "📁"} ${name}`,
					action: "category",
					payload: name,
					variant: name === activeCategory && !query ? "primary" : "ghost",
				})),
			},
		},
	]
}

function reduceEmojiBrowser(
	state: EmojiBrowserState,
	action: string,
	payload: unknown,
): EmojiBrowserState {
	switch (action) {
		case "search":
			return { ...state, searchQuery: String(payload) }
		case "category":
			return { ...state, searchQuery: "", activeCategory: String(payload) }
		case "insert":
			return {
				...state,
				recentEmojis: [
					String(payload),
					...state.recentEmojis.filter((code) => code !== payload),
				].slice(0, 12),
			}
		default:
			return state
	}
}

export default definePlugin({
	manifest: {
		id: "github-emoji",
		name: "GitHub Emoji",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Convert :emoji_code: to emoji characters in the editor",
		icon: "smile",
		permissions: ["editor:write", "workspace:tabs"],
	},
	settings: {
		livePreview: {
			type: "boolean",
			label: "Replace emoji codes",
			description: "Render :emoji_code: as emoji characters in notes",
			default: true,
		},
		showInStatusBar: {
			type: "boolean",
			label: "Status bar indicator",
			description: "Show the emoji count in the status bar",
			default: true,
		},
	},
	contributes: {
		markdown: {
			inline: [
				{
					id: "github-emoji",
					pattern: ":([a-z0-9_+-]+):",
					flags: "gi",
					when: "livePreview",
					replacement: {
						type: "text",
						content: (match) => GITHUB_EMOJI_MAP[match[1].toLowerCase()] ?? match[0],
					},
				},
			],
		},
		commands: [
			{
				id: "open-browser",
				label: "Open Emoji Browser",
				icon: "smile",
				category: "Emoji",
				defaultHotkey: "mod+shift+e",
				run: (ctx) => ctx.workspace.openView("emoji-browser", { target: "right" }),
			},
			{
				id: "insert-reference",
				label: "Insert Emoji Quick Reference",
				icon: "book-open",
				category: "Emoji",
				run: (ctx) => ctx.editor.insertAtCursor(QUICK_REFERENCE),
			},
		],
		views: [
			{
				id: "emoji-browser",
				label: "Emoji Browser",
				icon: "smile",
				location: "sidebar-left",
				initialState: { searchQuery: "", activeCategory: "Smileys", recentEmojis: [] },
				render: (state: EmojiBrowserState) => renderEmojiBrowser(state),
				reduce: reduceEmojiBrowser,
				onAction(ctx, action, payload) {
					if (action === "insert") ctx.editor.insertAtCursor(GITHUB_EMOJI_MAP[String(payload)])
				},
			},
		],
		sidebarItems: [{ id: "emoji-browser", label: "Emoji", icon: "smile", view: "emoji-browser" }],
		statusBarItems: [
			{
				id: "emoji-status",
				position: "right",
				icon: "smile",
				text: `${EMOJI_COUNT} emojis`,
				tooltip: "Open the emoji browser",
				command: "open-browser",
				when: "showInStatusBar",
			},
		],
	},
})
