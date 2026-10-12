import {
	createPropertyDefinition,
	getVaultSchema,
	type PropertyDefinition,
	updateVaultSchema,
} from "@cortex/properties"
import { useSettingsStore } from "@cortex/settings"
import { useBookmarksStore } from "../stores/bookmarksStore"
import { type TemplateVault, useTemplateStore } from "../stores/templateStore"

export interface VaultSettingsImportInput {
	attachments?: { location: "root" | "same" | "custom"; customPath: string }
	dailyNotes?: { folder: string; format: string; templateName?: string }
	templates: { name: string; body: string }[]
	bookmarks: string[]
	propertyTypes: { key: string; type: string }[]
}

export interface VaultSettingsImportResult {
	attachments: boolean
	dailyNotes: boolean
	templates: number
	bookmarks: number
	propertyTypes: number
}

export interface VaultSettingsImportOptions {
	applyVaultSettings: boolean
}

async function importTemplates(
	vault: TemplateVault,
	templates: VaultSettingsImportInput["templates"],
): Promise<number> {
	const store = useTemplateStore.getState()
	await store.ensureTemplatesLoaded(vault)
	const existingNames = new Set(
		useTemplateStore.getState().templates.map((template) => template.name.toLocaleLowerCase()),
	)
	let created = 0
	for (const template of templates) {
		if (existingNames.has(template.name.toLocaleLowerCase())) continue
		await store.createTemplate(vault, {
			name: template.name,
			body: template.body,
			fileNamePattern: "{{ note.title }}",
		})
		existingNames.add(template.name.toLocaleLowerCase())
		created++
	}
	return created
}

async function importBookmarks(vaultPath: string, paths: readonly string[]): Promise<number> {
	const store = useBookmarksStore.getState()
	let added = 0
	for (const path of paths) {
		if (store.isBookmarked(vaultPath, path)) continue
		if (await useBookmarksStore.getState().addBookmark(vaultPath, path)) added++
	}
	return added
}

async function importPropertyTypes(
	vaultPath: string,
	propertyTypes: VaultSettingsImportInput["propertyTypes"],
): Promise<number> {
	if (propertyTypes.length === 0) return 0
	const schema = await getVaultSchema(vaultPath)
	const properties: PropertyDefinition[] = [...schema.properties]
	const taken = new Set(
		properties.flatMap((property) => [
			property.key.toLocaleLowerCase(),
			property.name.toLocaleLowerCase(),
		]),
	)
	for (const { key, type } of propertyTypes) {
		if (taken.has(key.toLocaleLowerCase())) continue
		properties.push(createPropertyDefinition({ name: key, key, type, properties }))
		taken.add(key.toLocaleLowerCase())
	}
	const added = properties.length - schema.properties.length
	if (added > 0) await updateVaultSchema(vaultPath, { ...schema, properties })
	return added
}

async function importDailyNotes(
	dailyNotes: NonNullable<VaultSettingsImportInput["dailyNotes"]>,
): Promise<void> {
	const settings = useSettingsStore.getState()
	const templateName = dailyNotes.templateName?.toLocaleLowerCase()
	const template = templateName
		? useTemplateStore
				.getState()
				.templates.find((candidate) => candidate.name.toLocaleLowerCase() === templateName)
		: undefined
	await settings.updateSetting("dailyNotes", "folder", dailyNotes.folder)
	await settings.updateSetting("dailyNotes", "format", dailyNotes.format)
	await settings.updateSetting("dailyNotes", "templateId", template?.id ?? "")
}

async function importAttachments(
	attachments: NonNullable<VaultSettingsImportInput["attachments"]>,
): Promise<void> {
	const settings = useSettingsStore.getState()
	await settings.updateSetting("editor", "imageStorageLocation", attachments.location)
	if (attachments.location === "custom") {
		await settings.updateSetting("editor", "imageStorageCustomPath", attachments.customPath)
	}
}

export async function applyVaultSettingsImport(
	vault: TemplateVault,
	input: VaultSettingsImportInput,
	options: VaultSettingsImportOptions,
): Promise<VaultSettingsImportResult> {
	const [templates, bookmarks, propertyTypes] = await Promise.all([
		importTemplates(vault, input.templates),
		importBookmarks(vault.path, input.bookmarks),
		importPropertyTypes(vault.path, input.propertyTypes),
	])
	const attachments = options.applyVaultSettings ? input.attachments : undefined
	const dailyNotes = options.applyVaultSettings ? input.dailyNotes : undefined
	if (attachments) await importAttachments(attachments)
	if (dailyNotes) await importDailyNotes(dailyNotes)
	return {
		attachments: attachments !== undefined,
		dailyNotes: dailyNotes !== undefined,
		templates,
		bookmarks,
		propertyTypes,
	}
}
