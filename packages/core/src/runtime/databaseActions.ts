import { getPlatform } from "@cortex/platform"
import {
	getBaseName,
	getParentPath,
	mapWithConcurrency,
	normalizePath,
} from "@cortex/platform/utils"
import {
	createNoteWithPropertyDefaults,
	getPropertiesRuntime,
	getVaultSchema,
	projectRawNote,
	removeFrontmatterValue,
	removeProperty,
	resolveCurrentPropertyActor,
	setFrontmatterValue,
	setProperty,
	updateVaultSchema,
} from "@cortex/properties"
import {
	buildDatabaseFromPreset,
	createDatabaseRow as createDatabaseRowModel,
	createDefaultDatabaseConfig,
	DATABASE_CONFIG_KEY,
	type DatabaseConfig,
	type DatabaseQueryContext,
	type DatabaseRowTemplate,
	detectDatabaseNote,
	getDatabasePreset,
	getDatabaseRowTitle,
	getDatabaseViewNotePath,
	isDatabaseRowPath,
	renameDatabaseOrderEntry,
	serializeDatabaseConfig,
	toIsoDate,
} from "@cortex/properties/database"
import { noteCache } from "../noteCache"
import { useDatabaseStore } from "../stores/databaseStore"
import { useVaultStore } from "../stores/vaultStore"
import { pathExists, resolveUniquePath, writeCleanNote } from "../utils/createdNote"
import { getPortableFileNameError } from "../utils/fileName"
import { reportAppError } from "../utils/reportAppError"
import { onDatabaseReleased } from "./databaseRuntime"
import { beginDatabaseCellWrite, beginDatabaseConfigWrite } from "./databaseWrites"

const CONFIG_WRITE_DELAY_MS = 400

const pendingConfigWrites = new Map<
	string,
	{
		timer: ReturnType<typeof setTimeout>
		viewNotePath: string
		config: DatabaseConfig
		end: () => void
	}
>()
const rowCreationQueues = new Map<string, Promise<unknown>>()

export interface CreateDatabaseRowInput {
	title?: string
	properties?: Record<string, unknown>
	body?: string
}

export interface CreateDatabaseInput {
	parentPath: string
	name: string
	presetId?: string
	samples?: boolean
}

export interface CreatedDatabase {
	folderPath: string
	viewNotePath: string
	samplePaths: string[]
}

function requireVaultPath(): string {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) throw new Error("No vault is open")
	return vaultPath
}

async function writeConfig(viewNotePath: string, config: DatabaseConfig): Promise<void> {
	const serialized = serializeDatabaseConfig(config)
	await getPropertiesRuntime().notes.updateNote(viewNotePath, (raw) =>
		setFrontmatterValue(raw, DATABASE_CONFIG_KEY, serialized),
	)
}

async function flushConfigWrite(folderPath: string): Promise<void> {
	const pending = pendingConfigWrites.get(folderPath)
	if (!pending) return
	clearTimeout(pending.timer)
	pendingConfigWrites.delete(folderPath)
	try {
		await writeConfig(pending.viewNotePath, pending.config)
	} catch (error) {
		await reportAppError({
			operation: "database.save-views",
			source: "databases",
			cause: error,
			userMessage: "Database views could not be saved.",
			context: { path: pending.viewNotePath },
		})
	} finally {
		pending.end()
	}
}

export async function flushDatabaseConfigWrites(): Promise<void> {
	await Promise.all([...pendingConfigWrites.keys()].map(flushConfigWrite))
}

onDatabaseReleased((folderPath) => void flushConfigWrite(folderPath))

export function updateDatabaseConfig(
	folderPath: string,
	update: (config: DatabaseConfig) => DatabaseConfig,
): void {
	const entry = useDatabaseStore.getState().databases[folderPath]
	if (!entry) return
	const config = update(entry.config)
	if (config === entry.config) return
	useDatabaseStore.getState().setConfig(folderPath, config)
	const previous = pendingConfigWrites.get(folderPath)
	if (previous) clearTimeout(previous.timer)
	pendingConfigWrites.set(folderPath, {
		viewNotePath: entry.viewNotePath,
		config,
		end: previous?.end ?? beginDatabaseConfigWrite(folderPath),
		timer: setTimeout(() => void flushConfigWrite(folderPath), CONFIG_WRITE_DELAY_MS),
	})
}

export function renameDatabaseRowOrder(oldPath: string, newPath: string): void {
	const folderPath = getParentPath(normalizePath(oldPath))
	if (!isDatabaseRowPath(oldPath, folderPath) || !isDatabaseRowPath(newPath, folderPath)) return
	const from = getDatabaseRowTitle(oldPath)
	const to = getDatabaseRowTitle(newPath)
	updateDatabaseConfig(folderPath, (config) => renameDatabaseOrderEntry(config, from, to))
}

export async function updateDatabaseCell(
	folderPath: string,
	path: string,
	key: string,
	value: unknown,
): Promise<void> {
	const store = useDatabaseStore.getState()
	const previous = store.rowsByFolder[folderPath]?.rows[path]?.meta[key]
	store.patchRowMeta(folderPath, path, key, value)
	const endWrite = beginDatabaseCellWrite(path, key, value)
	try {
		if (value === undefined) await removeProperty(path, key)
		else await setProperty(path, key, value)
	} catch (error) {
		useDatabaseStore.getState().patchRowMeta(folderPath, path, key, previous)
		await reportAppError({
			operation: "database.update-cell",
			source: "databases",
			cause: error,
			userMessage: error instanceof Error ? error.message : "The value could not be saved.",
			context: { path, key },
		})
	} finally {
		endWrite()
	}
}

async function writeRowNote(
	vaultPath: string,
	folderPath: string,
	{ title = "Untitled", properties = {}, body = "" }: CreateDatabaseRowInput,
): Promise<string> {
	const fileName = `${title.trim() || "Untitled"}.md`
	const validationError = getPortableFileNameError(fileName)
	if (validationError) throw new Error(validationError)
	const [filePath, initial] = await Promise.all([
		resolveUniquePath(folderPath, fileName),
		createNoteWithPropertyDefaults(vaultPath, ""),
	])
	let content = initial
	for (const [key, value] of Object.entries(properties)) {
		content = setFrontmatterValue(content, key, value)
	}
	if (body) content = content ? `${content.trimEnd()}\n\n${body}` : body
	await writeCleanNote(filePath, content)
	useDatabaseStore
		.getState()
		.upsertRows(folderPath, [createDatabaseRowModel(filePath, content, { mtime: 0, size: 0 })])
	return filePath
}

function enqueueRowCreation<T>(folderPath: string, task: () => Promise<T>): Promise<T> {
	const previous = rowCreationQueues.get(folderPath) ?? Promise.resolve()
	const next = previous.catch(() => undefined).then(task)
	rowCreationQueues.set(folderPath, next)
	void next.finally(() => {
		if (rowCreationQueues.get(folderPath) === next) rowCreationQueues.delete(folderPath)
	})
	return next
}

export async function createDatabaseRow(
	folderPath: string,
	input: CreateDatabaseRowInput = {},
): Promise<string> {
	const folder = normalizePath(folderPath)
	const vaultPath = requireVaultPath()
	const filePath = await enqueueRowCreation(folder, () => writeRowNote(vaultPath, folder, input))
	await useVaultStore.getState().refreshFiles()
	return filePath
}

export async function createDatabase({
	parentPath,
	name,
	presetId = "empty",
	samples = false,
}: CreateDatabaseInput): Promise<CreatedDatabase> {
	const vaultPath = requireVaultPath()
	const folderName = name.trim() || "Untitled database"
	const validationError = getPortableFileNameError(folderName)
	if (validationError) throw new Error(validationError)
	const folderPath = await resolveUniquePath(parentPath, folderName)
	const preset = buildDatabaseFromPreset(
		await getVaultSchema(vaultPath),
		getDatabasePreset(presetId),
	)
	await getPlatform().fs.createDir(folderPath)
	if (preset.schemaChanged) await updateVaultSchema(vaultPath, preset.schema)
	const viewNotePath = getDatabaseViewNotePath(folderPath)
	await writeCleanNote(
		viewNotePath,
		setFrontmatterValue("", DATABASE_CONFIG_KEY, serializeDatabaseConfig(preset.config)),
	)
	const samplePaths = samples
		? await Promise.all(
				preset.samples.map((sample) =>
					writeRowNote(vaultPath, folderPath, {
						title: sample.title,
						properties: sample.meta,
						body: sample.body,
					}),
				),
			)
		: []
	await useVaultStore.getState().refreshFiles()
	return { folderPath, viewNotePath, samplePaths }
}

async function findDetachedViewNote(folderPath: string): Promise<string | null> {
	const children = useVaultStore
		.getState()
		.files.filter((file) => !file.isDir && isDatabaseRowPath(file.path, folderPath))
	const matches = await mapWithConcurrency(children, 4, async (file) => {
		try {
			const raw =
				noteCache.getEntry(file.path)?.content ?? (await getPlatform().fs.readFile(file.path))
			return detectDatabaseNote(raw).isDatabase ? file.path : null
		} catch {
			return null
		}
	})
	return matches.find((path) => path !== null) ?? null
}

export async function convertFolderToDatabase(folderPath: string): Promise<string> {
	const viewNotePath = getDatabaseViewNotePath(folderPath)
	const { notes } = getPropertiesRuntime()
	const exists = await pathExists(viewNotePath)
	const raw = exists ? await notes.readNote(viewNotePath) : ""
	if (exists && detectDatabaseNote(raw).isDatabase) return viewNotePath
	if (!exists) {
		const detached = await findDetachedViewNote(folderPath)
		if (detached) {
			return await useVaultStore.getState().renameFile(detached, getBaseName(viewNotePath))
		}
	}
	const serialized = serializeDatabaseConfig(createDefaultDatabaseConfig())
	if (exists) {
		await notes.updateNote(viewNotePath, (current) =>
			detectDatabaseNote(current).isDatabase
				? current
				: setFrontmatterValue(current, DATABASE_CONFIG_KEY, serialized),
		)
	} else {
		await writeCleanNote(viewNotePath, setFrontmatterValue(raw, DATABASE_CONFIG_KEY, serialized))
	}
	await useVaultStore.getState().refreshFiles()
	return viewNotePath
}

export async function removeDatabase(folderPath: string): Promise<void> {
	const entry = useDatabaseStore.getState().databases[folderPath]
	if (!entry) return
	const pending = pendingConfigWrites.get(folderPath)
	if (pending) {
		clearTimeout(pending.timer)
		pendingConfigWrites.delete(folderPath)
		pending.end()
	}
	let remaining = ""
	await getPropertiesRuntime().notes.updateNote(entry.viewNotePath, (raw) => {
		remaining = removeFrontmatterValue(raw, DATABASE_CONFIG_KEY)
		return remaining
	})
	const projection = projectRawNote(remaining)
	if (!projection.body.trim() && Object.keys(projection.meta).length === 0) {
		await useVaultStore.getState().deleteFile(entry.viewNotePath)
	}
}

export async function deleteDatabaseRows(paths: readonly string[]): Promise<void> {
	await Promise.all(paths.map((path) => useVaultStore.getState().deleteFile(path)))
}

export async function getDatabaseQueryContext(): Promise<DatabaseQueryContext> {
	const today = toIsoDate(new Date())
	try {
		const vaultPath = requireVaultPath()
		const context = await getPropertiesRuntime().identity.getAuthorContext(vaultPath)
		return { currentUserId: resolveCurrentPropertyActor(context), today }
	} catch {
		return { currentUserId: null, today }
	}
}

function createTemplateId(templates: readonly DatabaseRowTemplate[], name: string): string {
	const base =
		name
			.toLocaleLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "template"
	const ids = new Set(templates.map((template) => template.id))
	if (!ids.has(base)) return base
	let suffix = 2
	while (ids.has(`${base}-${suffix}`)) suffix++
	return `${base}-${suffix}`
}

export async function saveDatabaseRowTemplate(
	folderPath: string,
	rowPath: string,
	name: string,
): Promise<void> {
	const raw = await getPropertiesRuntime().notes.readNote(rowPath)
	const projection = projectRawNote(raw)
	const properties = Object.fromEntries(
		Object.entries(projection.meta).filter(([key]) => key !== DATABASE_CONFIG_KEY),
	)
	updateDatabaseConfig(folderPath, (config) => {
		const templates = config.templates ?? []
		const template: DatabaseRowTemplate = {
			id: createTemplateId(templates, name),
			name: name.trim() || "Template",
		}
		if (Object.keys(properties).length) template.properties = properties
		if (projection.body.trim()) template.body = projection.body.trim()
		return { ...config, templates: [...templates, template] }
	})
}

export function removeDatabaseRowTemplate(folderPath: string, templateId: string): void {
	updateDatabaseConfig(folderPath, (config) => {
		const templates = (config.templates ?? []).filter((template) => template.id !== templateId)
		return { ...config, templates: templates.length ? templates : undefined }
	})
}
