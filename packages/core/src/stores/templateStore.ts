import { getPlatform } from "@cortex/platform"
import { ensureMarkdownExtension, VAULT_FILES } from "@cortex/platform/utils"
import {
	createNoteWithPropertyDefaults,
	invalidatePropertySuggestions,
	parseFrontmatter,
	serializeFrontmatter,
} from "@cortex/properties"
import { create } from "zustand"
import {
	createTemplateBodyFromNote,
	renderTemplate,
	type TemplateDefinition,
	type TemplateManifest,
	type TemplateRenderContext,
	validateTemplateManifest,
} from "../templates"
import { resolveUniquePath, writeCleanNote } from "../utils/createdNote"
import { getPortableFileNameError } from "../utils/fileName"
import { assertVaultPathWritable } from "./accessStore"

export type { TemplateDefinition, TemplateManifest, TemplateRenderContext }

export interface TemplateVault {
	path: string
	name: string
}

export interface TemplateInput {
	askName?: boolean
	name: string
	description?: string
	body?: string
	targetFolderPattern?: string
	fileNamePattern?: string
	customPlaceholders?: Record<string, string>
}

export interface TemplateUpdateInput {
	askName?: boolean
	name?: string
	description?: string
	body?: string
	targetFolderPattern?: string
	fileNamePattern?: string
	customPlaceholders?: Record<string, string>
}

export interface CreateNoteFromTemplateInput {
	templateId: string
	noteTitle?: string
	targetFolder?: string
	fileName?: string
	now?: Date
}

export interface TemplateInsertResult {
	properties: Record<string, unknown>
	body: string
}

export interface TemplatePreview {
	targetFolder: string
	fileName: string
	content: string
}

export interface TemplateShareLink {
	shareId: string
	audience: "team" | "link" | "market"
	groupId: string | null
	link: string | null
}

export interface RemoteTemplateEntry {
	definition: TemplateDefinition
	body: string
}

export interface TemplateState {
	templates: TemplateDefinition[]
	remoteTemplates: TemplateDefinition[]
	remoteBodies: Record<string, string>
	shares: Record<string, TemplateShareLink>
	setRemoteTemplates: (entries: RemoteTemplateEntry[]) => void
	setShareLink: (vault: TemplateVault, key: string, link: TemplateShareLink | null) => Promise<void>
	loadedVaultPath: string | null
	loading: boolean
	error: string | null
	loadTemplates: (vault: TemplateVault) => Promise<void>
	ensureTemplatesLoaded: (vault: TemplateVault) => Promise<void>
	createTemplate: (vault: TemplateVault, input: TemplateInput) => Promise<TemplateDefinition>
	updateTemplate: (
		vault: TemplateVault,
		templateId: string,
		input: TemplateUpdateInput,
	) => Promise<TemplateDefinition>
	duplicateTemplate: (vault: TemplateVault, templateId: string) => Promise<TemplateDefinition>
	deleteTemplate: (vault: TemplateVault, templateId: string) => Promise<void>
	readTemplateBody: (vault: TemplateVault, templateId: string) => Promise<string>
	createTemplateFromNote: (
		vault: TemplateVault,
		input: { name: string; noteContent: string; targetFolderPattern?: string },
	) => Promise<TemplateDefinition>
	restoreTemplate: (
		vault: TemplateVault,
		template: TemplateDefinition,
		body: string,
	) => Promise<void>
	markTemplateUsed: (vault: TemplateVault, templateId: string) => Promise<void>
	renderTemplateForInsert: (
		vault: TemplateVault,
		templateId: string,
		noteTitle: string,
	) => Promise<TemplateInsertResult>
	previewNoteFromTemplate: (
		vault: TemplateVault,
		input: CreateNoteFromTemplateInput,
	) => Promise<TemplatePreview>
	createNoteFromTemplate: (
		vault: TemplateVault,
		input: CreateNoteFromTemplateInput,
	) => Promise<string>
	reset: () => void
}

const templatesDirectoryName = VAULT_FILES.templates
const manifestFileName = "manifest.json"
const sharesFileName = "shares.json"
const emptyManifest: TemplateManifest = { version: 1, templates: [] }

function createId(): string {
	return crypto.randomUUID()
}

function nowIso(): string {
	return new Date().toISOString()
}

function normalizeTemplateName(value: string): string {
	const name = value.trim()
	if (!name) throw new Error("Template name cannot be empty")
	return name
}

function getTemplatesDirectory(vaultPath: string): string {
	return `${vaultPath}/${templatesDirectoryName}`
}

function getManifestPath(vaultPath: string): string {
	return `${getTemplatesDirectory(vaultPath)}/${manifestFileName}`
}

function getTemplateBodyPath(vaultPath: string, bodyPath: string): string {
	return `${getTemplatesDirectory(vaultPath)}/${bodyPath}`
}

function createTemplateBodyPath(templateId: string): string {
	return `${templateId}.md`
}

function normalizeSlashes(value: string): string {
	return value.replaceAll("\\", "/")
}

function trimSlashes(value: string): string {
	return normalizeSlashes(value).replace(/^\/+|\/+$/g, "")
}

function validateRelativePath(value: string, label: string): string {
	const trimmed = trimSlashes(value.trim())
	if (!trimmed) return ""
	if (normalizeSlashes(value).startsWith("/")) {
		throw new Error(`${label} must stay inside the vault`)
	}
	const segments = trimmed.split("/").filter(Boolean)
	for (const segment of segments) {
		const error = getPortableFileNameError(segment)
		if (error) throw new Error(`${label}: ${error}`)
	}
	return segments.join("/")
}

function normalizeMarkdownFileName(value: string): string {
	const trimmed = value.trim()
	if (!trimmed || trimmed.toLocaleLowerCase() === ".md") {
		throw new Error("Saved title cannot be empty")
	}
	const fileName = ensureMarkdownExtension(trimmed)
	const error = getPortableFileNameError(fileName)
	if (error) throw new Error(error)
	return fileName
}

async function readManifest(vaultPath: string): Promise<TemplateManifest> {
	try {
		const content = await getPlatform().fs.readFile(getManifestPath(vaultPath))
		return validateTemplateManifest(JSON.parse(content))
	} catch {
		return emptyManifest
	}
}

async function writeManifest(vaultPath: string, manifest: TemplateManifest): Promise<void> {
	const templates = manifest.templates.filter((template) => template.source !== "team")
	await getPlatform().fs.createDir(getTemplatesDirectory(vaultPath))
	await getPlatform().fs.writeFile(
		getManifestPath(vaultPath),
		JSON.stringify({ version: 1, templates }, null, 2),
	)
}

function getSharesPath(vaultPath: string): string {
	return `${getTemplatesDirectory(vaultPath)}/${sharesFileName}`
}

async function readShares(vaultPath: string): Promise<Record<string, TemplateShareLink>> {
	try {
		const parsed = JSON.parse(await getPlatform().fs.readFile(getSharesPath(vaultPath)))
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
		return Object.fromEntries(
			Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) => {
				if (!value || typeof value !== "object") return []
				const link = value as Partial<TemplateShareLink>
				if (typeof link.shareId !== "string" || typeof link.audience !== "string") return []
				return [
					[
						key,
						{
							shareId: link.shareId,
							audience: link.audience,
							groupId: typeof link.groupId === "string" ? link.groupId : null,
							link: typeof link.link === "string" ? link.link : null,
						} as TemplateShareLink,
					],
				]
			}),
		)
	} catch {
		return {}
	}
}

async function writeShares(vaultPath: string, shares: Record<string, TemplateShareLink>) {
	await getPlatform().fs.createDir(getTemplatesDirectory(vaultPath))
	await getPlatform().fs.writeFile(getSharesPath(vaultPath), JSON.stringify(shares, null, 2))
}

function withRemote(local: TemplateDefinition[], remote: TemplateDefinition[]) {
	const localIds = new Set(local.map((template) => template.id))
	return [...local, ...remote.filter((template) => !localIds.has(template.id))]
}

async function writeTemplateBody(vaultPath: string, definition: TemplateDefinition, body: string) {
	await getPlatform().fs.createDir(getTemplatesDirectory(vaultPath))
	await getPlatform().fs.writeFile(getTemplateBodyPath(vaultPath, definition.bodyPath), body)
}

function findTemplate(templates: TemplateDefinition[], templateId: string): TemplateDefinition {
	const template = templates.find((item) => item.id === templateId)
	if (!template) throw new Error(`Template "${templateId}" was not found`)
	return template
}

function createTemplateContext(
	vault: TemplateVault,
	template: TemplateDefinition,
	noteTitle: string,
	targetFolder: string,
	fileName: string,
	now: Date,
): TemplateRenderContext {
	return {
		now,
		vault,
		template: {
			id: template.id,
			name: template.name,
		},
		note: {
			title: noteTitle,
			fileName,
			folder: targetFolder,
		},
		customPlaceholders: template.customPlaceholders,
	}
}

async function renderTemplatePreview(
	vault: TemplateVault,
	template: TemplateDefinition,
	body: string,
	input: CreateNoteFromTemplateInput,
): Promise<TemplatePreview> {
	const now = input.now ?? new Date()
	const noteTitle = input.noteTitle?.trim() || template.name
	const baseContext = createTemplateContext(vault, template, noteTitle, "", "", now)
	const targetFolder = validateRelativePath(
		input.targetFolder ?? renderTemplate(template.targetFolderPattern, baseContext).value,
		"Target folder",
	)
	const fileNameContext = createTemplateContext(vault, template, noteTitle, targetFolder, "", now)
	const renderedFileName =
		input.fileName ?? renderTemplate(template.fileNamePattern, fileNameContext).value
	const fallbackFileName = renderTemplate("{{ note.title | slug }}", fileNameContext).value
	const fileName = normalizeMarkdownFileName(
		renderedFileName.trim() ? renderedFileName : fallbackFileName || "untitled",
	)
	const contentContext = createTemplateContext(
		vault,
		template,
		noteTitle,
		targetFolder,
		fileName,
		now,
	)
	return {
		targetFolder,
		fileName,
		content: renderTemplate(body, contentContext).value,
	}
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
	templates: [],
	remoteTemplates: [],
	remoteBodies: {},
	shares: {},

	setRemoteTemplates: (entries) => {
		const remoteTemplates = entries.map((entry) => entry.definition)
		const remoteBodies = Object.fromEntries(
			entries.map((entry) => [entry.definition.id, entry.body]),
		)
		const local = get().templates.filter((template) => template.source !== "team")
		set({ remoteTemplates, remoteBodies, templates: withRemote(local, remoteTemplates) })
	},

	setShareLink: async (vault, key, link) => {
		const shares = { ...get().shares }
		if (link) shares[key] = link
		else delete shares[key]
		set({ shares })
		await writeShares(vault.path, shares)
	},
	loadedVaultPath: null,
	loading: false,
	error: null,

	loadTemplates: async (vault) => {
		set({ loading: true, error: null })
		try {
			const [manifest, shares] = await Promise.all([
				readManifest(vault.path),
				readShares(vault.path),
			])
			set({
				shares,
				templates: withRemote(manifest.templates, get().remoteTemplates),
				loadedVaultPath: vault.path,
				loading: false,
			})
		} catch (error) {
			set({ loading: false, error: String(error) })
		}
	},

	ensureTemplatesLoaded: async (vault) => {
		if (get().loadedVaultPath === vault.path) return
		await get().loadTemplates(vault)
	},

	createTemplate: async (vault, input) => {
		await get().ensureTemplatesLoaded(vault)
		const timestamp = nowIso()
		const template: TemplateDefinition = {
			id: createId(),
			name: normalizeTemplateName(input.name),
			description: input.description?.trim() || undefined,
			bodyPath: "",
			targetFolderPattern: input.targetFolderPattern ?? "",
			fileNamePattern: input.fileNamePattern ?? "{{ note.title | slug }}",
			customPlaceholders: input.customPlaceholders,
			askName: input.askName,
			source: "vault",
			createdAt: timestamp,
			updatedAt: timestamp,
		}
		template.bodyPath = createTemplateBodyPath(template.id)
		const templates = [...get().templates, template]
		await writeTemplateBody(vault.path, template, input.body ?? "")
		await writeManifest(vault.path, { version: 1, templates })
		set({ templates, loadedVaultPath: vault.path })
		return template
	},

	updateTemplate: async (vault, templateId, input) => {
		await get().ensureTemplatesLoaded(vault)
		const current = findTemplate(get().templates, templateId)
		const updated: TemplateDefinition = {
			...current,
			name: input.name === undefined ? current.name : normalizeTemplateName(input.name),
			description:
				input.description === undefined
					? current.description
					: input.description.trim() || undefined,
			targetFolderPattern:
				input.targetFolderPattern === undefined
					? current.targetFolderPattern
					: input.targetFolderPattern,
			fileNamePattern:
				input.fileNamePattern === undefined ? current.fileNamePattern : input.fileNamePattern,
			customPlaceholders:
				input.customPlaceholders === undefined
					? current.customPlaceholders
					: input.customPlaceholders,
			askName: input.askName === undefined ? current.askName : input.askName,
			updatedAt: nowIso(),
		}
		const templates = get().templates.map((template) =>
			template.id === templateId ? updated : template,
		)
		if (input.body !== undefined) await writeTemplateBody(vault.path, updated, input.body)
		await writeManifest(vault.path, { version: 1, templates })
		set({ templates, loadedVaultPath: vault.path })
		return updated
	},

	duplicateTemplate: async (vault, templateId) => {
		await get().ensureTemplatesLoaded(vault)
		const current = findTemplate(get().templates, templateId)
		const body = await get().readTemplateBody(vault, templateId)
		return get().createTemplate(vault, {
			name: `${current.name} copy`,
			description: current.description,
			body,
			targetFolderPattern: current.targetFolderPattern,
			fileNamePattern: current.fileNamePattern,
			customPlaceholders: current.customPlaceholders,
			askName: current.askName,
		})
	},

	createTemplateFromNote: async (vault, input) => {
		const { meta, body } = parseFrontmatter(input.noteContent)
		const properties = Object.fromEntries(Object.keys(meta).map((key) => [key, null]))
		return get().createTemplate(vault, {
			name: input.name,
			body: serializeFrontmatter(properties, createTemplateBodyFromNote(body)),
			targetFolderPattern: input.targetFolderPattern,
			fileNamePattern: "{{ note.title }}",
			askName: true,
		})
	},

	restoreTemplate: async (vault, template, body) => {
		await get().ensureTemplatesLoaded(vault)
		const templates = [...get().templates.filter((item) => item.id !== template.id), template]
		await writeTemplateBody(vault.path, template, body)
		await writeManifest(vault.path, { version: 1, templates })
		set({ templates, loadedVaultPath: vault.path })
	},

	markTemplateUsed: async (vault, templateId) => {
		await get().ensureTemplatesLoaded(vault)
		const templates = get().templates.map((template) =>
			template.id === templateId ? { ...template, lastUsedAt: nowIso() } : template,
		)
		set({ templates })
		await writeManifest(vault.path, { version: 1, templates }).catch(() => undefined)
	},

	renderTemplateForInsert: async (vault, templateId, noteTitle) => {
		await get().ensureTemplatesLoaded(vault)
		const template = findTemplate(get().templates, templateId)
		const source = await get().readTemplateBody(vault, templateId)
		const context = createTemplateContext(vault, template, noteTitle, "", "", new Date())
		const rendered = parseFrontmatter(renderTemplate(source, context).value)
		void get().markTemplateUsed(vault, templateId)
		return { properties: rendered.meta, body: rendered.body }
	},

	deleteTemplate: async (vault, templateId) => {
		await get().ensureTemplatesLoaded(vault)
		const current = findTemplate(get().templates, templateId)
		const templates = get().templates.filter((template) => template.id !== templateId)
		await getPlatform()
			.fs.deleteFile(getTemplateBodyPath(vault.path, current.bodyPath))
			.catch(() => undefined)
		await writeManifest(vault.path, { version: 1, templates })
		set({ templates, loadedVaultPath: vault.path })
	},

	readTemplateBody: async (vault, templateId) => {
		await get().ensureTemplatesLoaded(vault)
		const remoteBody = get().remoteBodies[templateId]
		if (remoteBody !== undefined) return remoteBody
		const template = findTemplate(get().templates, templateId)
		try {
			return await getPlatform().fs.readFile(getTemplateBodyPath(vault.path, template.bodyPath))
		} catch {
			return ""
		}
	},

	previewNoteFromTemplate: async (vault, input) => {
		await get().ensureTemplatesLoaded(vault)
		const template = findTemplate(get().templates, input.templateId)
		const body = await get().readTemplateBody(vault, template.id)
		return renderTemplatePreview(vault, template, body, input)
	},

	createNoteFromTemplate: async (vault, input) => {
		const preview = await get().previewNoteFromTemplate(vault, input)
		void get().markTemplateUsed(vault, input.templateId)
		const folderPath = preview.targetFolder ? `${vault.path}/${preview.targetFolder}` : vault.path
		assertVaultPathWritable(folderPath, true)
		const [filePath, content] = await Promise.all([
			resolveUniquePath(folderPath, preview.fileName),
			createNoteWithPropertyDefaults(vault.path, preview.content),
		])
		await writeCleanNote(filePath, content)
		invalidatePropertySuggestions(vault.path)
		return filePath
	},

	reset: () => {
		set({
			templates: [],
			remoteTemplates: [],
			remoteBodies: {},
			shares: {},
			loadedVaultPath: null,
			loading: false,
			error: null,
		})
	},
}))
