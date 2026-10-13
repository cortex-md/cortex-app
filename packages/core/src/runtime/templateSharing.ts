import {
	getPlatform,
	type PublicTemplateInfo,
	type TemplateBundle,
	type TemplateShareAudience,
	type TemplateShareInfo,
	type TemplateShares,
} from "@cortex/platform"
import { type DatabasePreset, parseDatabasePreset } from "@cortex/properties/database"
import {
	createNoteTemplateBundle,
	readNoteTemplateBundle,
	type TemplateDefinition,
} from "@cortex/templates"
import { create } from "zustand"
import { useAuthStore } from "../stores/authStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import {
	type RemoteTemplateEntry,
	type TemplateShareLink,
	type TemplateVault,
	useTemplateStore,
} from "../stores/templateStore"
import { exportDatabasePreset } from "./databaseActions"

const databasePresetPath = "database.json"

export interface SharedDatabasePreset {
	shareId: string
	groupName: string | null
	ownerName: string
	preset: DatabasePreset
}

export interface TemplateSharingState {
	teamDatabasePresets: SharedDatabasePreset[]
	refreshing: boolean
	lastError: string | null
}

export const useTemplateSharingStore = create<TemplateSharingState>(() => ({
	teamDatabasePresets: [],
	refreshing: false,
	lastError: null,
}))

export interface ShareTemplateOptions {
	audience: TemplateShareAudience
	groupId: string | null
	description: string
	includeSamples: boolean
}

const bundleCache = new Map<string, TemplateBundle>()

function requireTemplateShares(): TemplateShares {
	const api = getPlatform().templateShares
	if (!api) throw new Error("Sharing templates isn’t available on this device.")
	return api
}

export function getLinkedRemoteVaultId(): string | null {
	const { syncConfig } = useRemoteVaultStore.getState()
	return syncConfig.enabled ? syncConfig.remoteVaultId : null
}

function requireRemoteVaultId(): string {
	const remoteVaultId = getLinkedRemoteVaultId()
	if (!remoteVaultId) throw new Error("Sync this vault to share templates.")
	return remoteVaultId
}

export function noteTemplateShareKey(templateId: string): string {
	return `note:${templateId}`
}

export function databaseTemplateShareKey(folderPath: string, vaultPath: string): string {
	const relative = folderPath.startsWith(vaultPath)
		? folderPath.slice(vaultPath.length).replace(/^\/+/, "")
		: folderPath
	return `database:${relative}`
}

function toShareLink(info: TemplateShareInfo): TemplateShareLink {
	return {
		shareId: info.id,
		audience: info.audience,
		groupId: info.groupId,
		link: info.link,
	}
}

async function publish(
	vault: TemplateVault,
	key: string,
	input: {
		kind: "note" | "database"
		name: string
		options: ShareTemplateOptions
		bundle: TemplateBundle
	},
): Promise<TemplateShareInfo> {
	const api = requireTemplateShares()
	const remoteVaultId = requireRemoteVaultId()
	const existing = useTemplateStore.getState().shares[key]
	let info: TemplateShareInfo
	if (existing) {
		info = await api.update(remoteVaultId, existing.shareId, {
			audience: input.options.audience,
			groupId: input.options.audience === "team" ? input.options.groupId : null,
			name: input.name,
			description: input.options.description,
			includeSamples: input.options.includeSamples,
			bundle: input.bundle,
		})
	} else {
		info = await api.share(remoteVaultId, {
			kind: input.kind,
			audience: input.options.audience,
			groupId: input.options.audience === "team" ? input.options.groupId : null,
			name: input.name,
			description: input.options.description,
			includeSamples: input.options.includeSamples,
			bundle: input.bundle,
		})
	}
	await useTemplateStore.getState().setShareLink(vault, key, toShareLink(info))
	return info
}

export async function shareNoteTemplate(
	vault: TemplateVault,
	templateId: string,
	options: ShareTemplateOptions,
): Promise<TemplateShareInfo> {
	const store = useTemplateStore.getState()
	const template = store.templates.find((item) => item.id === templateId)
	if (!template) throw new Error("This template no longer exists.")
	const body = await store.readTemplateBody(vault, templateId)
	const bundle = createNoteTemplateBundle(
		{
			name: template.name,
			description: options.description || template.description,
			targetFolderPattern: template.targetFolderPattern,
			fileNamePattern: template.fileNamePattern,
			askName: template.askName,
			customPlaceholders: template.customPlaceholders,
		},
		body,
	)
	return publish(vault, noteTemplateShareKey(templateId), {
		kind: "note",
		name: template.name,
		options,
		bundle,
	})
}

export async function shareDatabaseTemplate(
	vault: TemplateVault,
	folderPath: string,
	name: string,
	options: ShareTemplateOptions,
): Promise<TemplateShareInfo> {
	const preset = await exportDatabasePreset(folderPath, {
		includeSamples: options.includeSamples,
		hint: options.description,
	})
	const bundle: TemplateBundle = {
		format: 1,
		kind: "database",
		files: [{ path: databasePresetPath, content: JSON.stringify(preset, null, 2) }],
	}
	return publish(vault, databaseTemplateShareKey(folderPath, vault.path), {
		kind: "database",
		name,
		options,
		bundle,
	})
}

export async function republishNoteTemplate(vault: TemplateVault, templateId: string) {
	const key = noteTemplateShareKey(templateId)
	const link = useTemplateStore.getState().shares[key]
	if (!link) return
	const store = useTemplateStore.getState()
	const template = store.templates.find((item) => item.id === templateId)
	if (!template) return
	const body = await store.readTemplateBody(vault, templateId)
	const bundle = createNoteTemplateBundle(
		{
			name: template.name,
			description: template.description,
			targetFolderPattern: template.targetFolderPattern,
			fileNamePattern: template.fileNamePattern,
			askName: template.askName,
			customPlaceholders: template.customPlaceholders,
		},
		body,
	)
	const info = await requireTemplateShares().republish(
		requireRemoteVaultId(),
		link.shareId,
		link.audience,
		bundle,
	)
	await store.setShareLink(vault, key, toShareLink(info))
}

export async function stopSharingTemplate(vault: TemplateVault, key: string): Promise<void> {
	const link = useTemplateStore.getState().shares[key]
	if (!link) return
	const remoteVaultId = requireRemoteVaultId()
	await requireTemplateShares().revoke(remoteVaultId, link.shareId)
	await useTemplateStore.getState().setShareLink(vault, key, null)
}

function readDatabaseBundle(bundle: TemplateBundle): DatabasePreset | null {
	if (bundle.kind !== "database") return null
	const file = bundle.files.find((item) => item.path === databasePresetPath)
	if (!file) return null
	try {
		return parseDatabasePreset(JSON.parse(file.content))
	} catch {
		return null
	}
}

function toRemoteNoteTemplate(
	info: TemplateShareInfo,
	bundle: TemplateBundle,
): RemoteTemplateEntry | null {
	const parsed = readNoteTemplateBundle(bundle)
	if (!parsed) return null
	const definition: TemplateDefinition = {
		id: `team-${info.id}`,
		name: parsed.fields.name,
		description: parsed.fields.description || info.description || undefined,
		bodyPath: `team-${info.id}.md`,
		targetFolderPattern: parsed.fields.targetFolderPattern,
		fileNamePattern: parsed.fields.fileNamePattern,
		customPlaceholders: parsed.fields.customPlaceholders,
		askName: parsed.fields.askName,
		source: "team",
		remote: {
			id: info.id,
			version: info.version,
			sharedBy: info.ownerName || undefined,
			group: info.groupName ?? undefined,
		},
		createdAt: info.updatedAt,
		updatedAt: info.updatedAt,
	}
	return { definition, body: parsed.body }
}

async function fetchBundle(remoteVaultId: string, info: TemplateShareInfo) {
	const cacheKey = `${info.id}:${info.version}`
	const cached = bundleCache.get(cacheKey)
	if (cached) return cached
	const bundle = await requireTemplateShares().fetch(remoteVaultId, info.id)
	bundleCache.set(cacheKey, bundle)
	return bundle
}

export async function refreshTeamTemplates(): Promise<void> {
	const api = getPlatform().templateShares
	const remoteVaultId = getLinkedRemoteVaultId()
	if (!api || !remoteVaultId || !useAuthStore.getState().user) {
		useTemplateStore.getState().setRemoteTemplates([])
		useTemplateSharingStore.setState({ teamDatabasePresets: [] })
		return
	}
	useTemplateSharingStore.setState({ refreshing: true })
	try {
		const myShareIds = new Set(
			Object.values(useTemplateStore.getState().shares).map((link) => link.shareId),
		)
		const team = (await api.list(remoteVaultId)).filter(
			(info) => info.audience === "team" && info.status === "published" && !myShareIds.has(info.id),
		)
		const fetched = await Promise.all(
			team.map(async (info) => {
				try {
					return { info, bundle: await fetchBundle(remoteVaultId, info) }
				} catch {
					return null
				}
			}),
		)
		const notes: RemoteTemplateEntry[] = []
		const databases: SharedDatabasePreset[] = []
		for (const item of fetched) {
			if (!item) continue
			if (item.info.kind === "note") {
				const entry = toRemoteNoteTemplate(item.info, item.bundle)
				if (entry) notes.push(entry)
				continue
			}
			const preset = readDatabaseBundle(item.bundle)
			if (preset) {
				databases.push({
					shareId: item.info.id,
					groupName: item.info.groupName,
					ownerName: item.info.ownerName,
					preset: { ...preset, id: `team-${item.info.id}`, name: item.info.name },
				})
			}
		}
		useTemplateStore.getState().setRemoteTemplates(notes)
		useTemplateSharingStore.setState({
			teamDatabasePresets: databases,
			refreshing: false,
			lastError: null,
		})
	} catch (error) {
		useTemplateSharingStore.setState({
			refreshing: false,
			lastError: error instanceof Error ? error.message : String(error),
		})
	}
}

export interface OpenedPublicTemplate {
	template: PublicTemplateInfo
	note: { name: string; description: string; body: string; fields: TemplateDefinition } | null
	database: DatabasePreset | null
	files: string[]
}

export async function listMarketTemplates(query: {
	kind?: "note" | "database"
	text?: string
}): Promise<PublicTemplateInfo[]> {
	return requireTemplateShares().market(query)
}

export async function openPublicTemplate(slug: string): Promise<OpenedPublicTemplate> {
	const { template, bundle } = await requireTemplateShares().open(slug)
	const parsed = readNoteTemplateBundle(bundle)
	const now = new Date().toISOString()
	return {
		template,
		note: parsed
			? {
					name: parsed.fields.name,
					description: parsed.fields.description ?? "",
					body: parsed.body,
					fields: {
						id: `public-${template.slug}`,
						name: parsed.fields.name,
						description: parsed.fields.description,
						bodyPath: `public-${template.slug}.md`,
						targetFolderPattern: parsed.fields.targetFolderPattern,
						fileNamePattern: parsed.fields.fileNamePattern,
						askName: parsed.fields.askName,
						customPlaceholders: parsed.fields.customPlaceholders,
						createdAt: now,
						updatedAt: now,
					},
				}
			: null,
		database: readDatabaseBundle(bundle),
		files: bundle.files.map((file) => file.path),
	}
}

export async function addPublicNoteTemplate(
	vault: TemplateVault,
	opened: OpenedPublicTemplate,
	source: "link" | "market",
): Promise<TemplateDefinition> {
	if (!opened.note) throw new Error("This isn’t a note template.")
	const store = useTemplateStore.getState()
	const created = await store.createTemplate(vault, {
		name: opened.note.name,
		description: opened.note.description,
		body: opened.note.body,
		targetFolderPattern: opened.note.fields.targetFolderPattern,
		fileNamePattern: opened.note.fields.fileNamePattern,
		customPlaceholders: opened.note.fields.customPlaceholders,
		askName: opened.note.fields.askName,
	})
	const definition: TemplateDefinition = {
		...created,
		source,
		remote: { id: opened.template.slug, version: opened.template.version },
	}
	await store.restoreTemplate(vault, definition, opened.note.body)
	return definition
}
