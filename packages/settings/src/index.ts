export {
	DEFAULT_ACCENT_COLOR,
	DEFAULT_APP_SETTINGS,
	DEFAULT_APPEARANCE_SETTINGS,
	DEFAULT_DAILY_NOTES_SETTINGS,
	DEFAULT_EDITOR_SETTINGS,
	DEFAULT_FILES_SETTINGS,
	DEFAULT_GENERAL_SETTINGS,
	DEFAULT_PLUGINS_SETTINGS,
	DEFAULT_TASKS_SETTINGS,
	DEFAULT_TEMPLATES_SETTINGS,
	SYSTEM_FONT_FAMILY,
	SYSTEM_FONT_STACK,
} from "./defaults"
export { FONT_SIZE_LIMITS, type FontScaleStep, stepFontSizes } from "./fontScale"
export { filterSettingsPages, type SearchableSettingsPage } from "./pageSearch"
export { getSettingsManager, initSettingsManager, SettingsManager } from "./SettingsManager"
export { getSettingsField, SETTINGS_FIELDS, type SettingsFieldEntry } from "./settingsFields"
export {
	normalizeSearchText,
	type SettingsSearchItem,
	type SettingsSearchItemKind,
	type SettingsSearchRange,
	type SettingsSearchResult,
	searchSettings,
} from "./settingsSearch"
export { useSettingsStore } from "./store"
export type {
	AppearanceSettings,
	AppSettings,
	DailyNotesSettings,
	EditorSettings,
	FilesSettings,
	GeneralSettings,
	GlobalAppSettings,
	PluginsSettings,
	SettingsChangeEvent,
	TasksSettings,
	TemplatesSettings,
} from "./types"
export {
	AppearanceSettingsSchema,
	AppSettingsSchema,
	DailyNotesSettingsSchema,
	EditorSettingsSchema,
	FilesSettingsSchema,
	GeneralSettingsSchema,
	GlobalAppSettingsSchema,
	PluginsSettingsSchema,
	TasksSettingsSchema,
	TemplatesSettingsSchema,
} from "./types"
