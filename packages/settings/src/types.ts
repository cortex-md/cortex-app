import { z } from "zod"
import {
	DEFAULT_APP_SETTINGS,
	DEFAULT_APPEARANCE_SETTINGS,
	DEFAULT_EDITOR_SETTINGS,
	DEFAULT_FILES_SETTINGS,
	DEFAULT_GENERAL_SETTINGS,
	DEFAULT_HOTKEYS_SETTINGS,
} from "./defaults"

const AppearanceSettingsInputSchema = z.object({
	theme: z.string().default(DEFAULT_APPEARANCE_SETTINGS.theme),
	colorscheme: z.enum(["light", "dark", "system"]).default(DEFAULT_APPEARANCE_SETTINGS.colorscheme),
	accentColor: z.string().default(DEFAULT_APPEARANCE_SETTINGS.accentColor),
	uiFontFamily: z.string().default(DEFAULT_APPEARANCE_SETTINGS.uiFontFamily),
	uiFontSize: z.number().min(10).max(24).default(DEFAULT_APPEARANCE_SETTINGS.uiFontSize),
	nativeWindowEffects: z.boolean().optional(),
	nativeContentSurface: z.boolean().optional(),
	editorFontFamily: z.string().default(DEFAULT_APPEARANCE_SETTINGS.editorFontFamily),
	editorFontSize: z.number().min(10).max(24).default(DEFAULT_APPEARANCE_SETTINGS.editorFontSize),
	lineHeight: z.number().min(1).max(2).default(DEFAULT_APPEARANCE_SETTINGS.lineHeight),
})

export const AppearanceSettingsSchema = AppearanceSettingsInputSchema.transform((settings) => {
	const { nativeContentSurface, nativeWindowEffects, ...appearance } = settings
	return {
		...appearance,
		nativeWindowEffects:
			nativeWindowEffects ??
			nativeContentSurface ??
			DEFAULT_APPEARANCE_SETTINGS.nativeWindowEffects,
	}
})

export const GlobalAppSettingsSchema = z.object({
	appearance: z
		.object({
			nativeWindowEffects: z.boolean().default(DEFAULT_APPEARANCE_SETTINGS.nativeWindowEffects),
		})
		.default({
			nativeWindowEffects: DEFAULT_APPEARANCE_SETTINGS.nativeWindowEffects,
		}),
})

export const EditorSettingsSchema = z.object({
	tabSize: z.number().min(2).max(8).default(DEFAULT_EDITOR_SETTINGS.tabSize),
	useSpaces: z.boolean().default(DEFAULT_EDITOR_SETTINGS.useSpaces),
	wordWrap: z.boolean().default(DEFAULT_EDITOR_SETTINGS.wordWrap),
	folding: z.boolean().default(DEFAULT_EDITOR_SETTINGS.folding),
	showLineNumbers: z.boolean().default(DEFAULT_EDITOR_SETTINGS.showLineNumbers),
	vimMode: z.boolean().default(DEFAULT_EDITOR_SETTINGS.vimMode),
	slashCommands: z.boolean().default(DEFAULT_EDITOR_SETTINGS.slashCommands),
	markdownToolbar: z.boolean().default(DEFAULT_EDITOR_SETTINGS.markdownToolbar),
	autoSave: z.boolean().default(DEFAULT_EDITOR_SETTINGS.autoSave),
	autoSaveInterval: z.number().min(1000).default(DEFAULT_EDITOR_SETTINGS.autoSaveInterval),
	imageStorageLocation: z
		.enum(["root", "same", "custom"])
		.default(DEFAULT_EDITOR_SETTINGS.imageStorageLocation),
	imageStorageCustomPath: z.string().default(DEFAULT_EDITOR_SETTINGS.imageStorageCustomPath),
})

export const FilesSettingsSchema = z.object({
	excludePatterns: z.array(z.string()).default([...DEFAULT_FILES_SETTINGS.excludePatterns]),
	hideHiddenFiles: z.boolean().default(DEFAULT_FILES_SETTINGS.hideHiddenFiles),
})

export const GeneralSettingsSchema = z.object({
	autoOpenLastVault: z.boolean().default(DEFAULT_GENERAL_SETTINGS.autoOpenLastVault),
})

export const HotkeysSettingsSchema = z
	.record(z.string(), z.string())
	.default(DEFAULT_HOTKEYS_SETTINGS)

export const AppSettingsSchema = z.object({
	general: GeneralSettingsSchema.default(DEFAULT_APP_SETTINGS.general),
	appearance: AppearanceSettingsSchema.default(DEFAULT_APP_SETTINGS.appearance),
	editor: EditorSettingsSchema.default(DEFAULT_APP_SETTINGS.editor),
	files: FilesSettingsSchema.default({
		excludePatterns: [...DEFAULT_APP_SETTINGS.files.excludePatterns],
		hideHiddenFiles: DEFAULT_APP_SETTINGS.files.hideHiddenFiles,
	}),
	hotkeys: HotkeysSettingsSchema.default(DEFAULT_APP_SETTINGS.hotkeys),
})

export type AppearanceSettings = z.infer<typeof AppearanceSettingsSchema>
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>
export type EditorSettings = z.infer<typeof EditorSettingsSchema>
export type FilesSettings = z.infer<typeof FilesSettingsSchema>
export type HotkeysSettings = z.infer<typeof HotkeysSettingsSchema>
export type AppSettings = z.infer<typeof AppSettingsSchema>
export type GlobalAppSettings = z.infer<typeof GlobalAppSettingsSchema>

export interface SettingsChangeEvent {
	section: keyof AppSettings
	key: string
	oldValue: unknown
	newValue: unknown
}
