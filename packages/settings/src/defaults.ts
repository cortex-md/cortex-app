export const SYSTEM_FONT_FAMILY = "System Default"
export const SYSTEM_FONT_STACK =
	'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
export const DEFAULT_ACCENT_COLOR = "#fb7185"

export const DEFAULT_GENERAL_SETTINGS = {
	autoOpenLastVault: true,
} as const

export const DEFAULT_APPEARANCE_SETTINGS = {
	theme: "default",
	colorscheme: "system",
	accentColor: DEFAULT_ACCENT_COLOR,
	uiFontFamily: SYSTEM_FONT_FAMILY,
	uiFontSize: 14,
	nativeWindowEffects: true,
	editorFontFamily: SYSTEM_FONT_FAMILY,
	editorFontSize: 16,
	lineHeight: 1.5,
} as const

export const DEFAULT_EDITOR_SETTINGS = {
	tabSize: 2,
	useSpaces: true,
	wordWrap: true,
	folding: true,
	showLineNumbers: true,
	vimMode: false,
	slashCommands: true,
	markdownToolbar: false,
	autoSave: true,
	autoSaveInterval: 2000,
	imageStorageLocation: "same",
	imageStorageCustomPath: "",
} as const

export const DEFAULT_FILES_SETTINGS = {
	excludePatterns: ["node_modules", ".git", "dist"],
	hideHiddenFiles: true,
} as const

export const DEFAULT_HOTKEYS_SETTINGS = {} as const

export const DEFAULT_APP_SETTINGS = {
	general: DEFAULT_GENERAL_SETTINGS,
	appearance: DEFAULT_APPEARANCE_SETTINGS,
	editor: DEFAULT_EDITOR_SETTINGS,
	files: DEFAULT_FILES_SETTINGS,
	hotkeys: DEFAULT_HOTKEYS_SETTINGS,
} as const
