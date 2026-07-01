import {
	buildDatabaseIndex,
	type CreateDatabaseInput,
	type CreateDatabaseViewInput,
	createDatabaseCatalogEntry,
	createDatabaseViewDefinition,
	DATABASE_CATALOG_FILE,
	DATABASE_MEMBERSHIP_PROPERTY_KEY,
	type DatabaseCatalog,
	type DatabaseDefinition,
	type DatabaseFileEntry,
	type DatabaseIndex,
	type DatabaseQueryResult,
	type DatabaseSource,
	type DatabaseViewDefinition,
	getDatabaseCatalog,
	getDatabaseMembershipIdsFromMeta,
	indexDatabaseFile,
	queryDatabaseView,
	removeDatabaseIndexPath,
	renameDatabaseIndexPath,
	updateDatabaseCatalog,
	upsertDatabaseIndexRow,
} from "@cortex/databases"
import type { FileEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	createPropertyDefinition,
	createPropertyOption,
	getPropertyMap,
	getPropertyType,
	getVaultSchema,
	isEmptyPropertyValue,
	type PropertyDefinition,
	type PropertyOption,
	removeProperty,
	setProperty,
	updatePropertyOption,
	updateVaultSchema,
} from "@cortex/properties"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { noteCache } from "../noteCache"

export const DATABASE_VIEW_ID = "database-view"

const emptyCatalog: DatabaseCatalog = {
	version: 1,
	databases: {},
	views: {},
	updatedAt: new Date(0).toISOString(),
}

let databaseIndexGeneration = 0

export interface DatabaseState {
	catalog: DatabaseCatalog
	index: DatabaseIndex | null
	loadedVaultPath: string | null
	indexing: boolean
	error: string | null

	loadCatalog: (vaultPath: string) => Promise<DatabaseCatalog>
	saveCatalog: (vaultPath: string, catalog: DatabaseCatalog) => Promise<DatabaseCatalog>
	createDatabase: (
		vaultPath: string,
		input: CreateDatabaseInput,
	) => Promise<{ database: DatabaseDefinition; view: DatabaseViewDefinition }>
	updateDatabase: (
		vaultPath: string,
		databaseId: string,
		updates: Partial<Omit<DatabaseDefinition, "id" | "createdAt">>,
	) => Promise<DatabaseDefinition | null>
	createView: (vaultPath: string, input: CreateDatabaseViewInput) => Promise<DatabaseViewDefinition>
	updateView: (
		vaultPath: string,
		viewId: string,
		updates: Partial<Omit<DatabaseViewDefinition, "id" | "databaseId" | "createdAt">>,
	) => Promise<DatabaseViewDefinition | null>
	updateViewColumns: (
		vaultPath: string,
		viewId: string,
		propertyKeys: string[],
	) => Promise<DatabaseViewDefinition | null>
	addPropertyToDatabase: (
		vaultPath: string,
		databaseId: string,
		viewId: string,
		input: { name: string; type: string; options?: PropertyOption[] },
	) => Promise<PropertyDefinition>
	updateSelectOption: (
		vaultPath: string,
		propertyKey: string,
		optionId: string,
		updates: Partial<Pick<PropertyOption, "label" | "color">>,
	) => Promise<PropertyDefinition | null>
	addSelectOption: (
		vaultPath: string,
		propertyKey: string,
		label?: string,
	) => Promise<PropertyDefinition | null>
	ensureBoardStatusProperty: (vaultPath: string) => Promise<PropertyDefinition>
	buildIndexFromFiles: (vaultPath: string, files: FileEntry[], force?: boolean) => Promise<void>
	indexFile: (vaultPath: string, filePath: string) => Promise<void>
	removeFileFromIndex: (filePath: string) => void
	renameFileInIndex: (oldPath: string, newPath: string) => void
	renameDatabaseReferences: (vaultPath: string, oldPath: string, newPath: string) => Promise<void>
	queryView: (
		vaultPath: string,
		databaseId: string,
		viewId: string,
	) => Promise<DatabaseQueryResult | null>
	linkNoteToDatabase: (
		vaultPath: string,
		filePath: string,
		databaseId: string,
		defaults?: Record<string, unknown>,
	) => Promise<void>
	unlinkNoteFromDatabase: (vaultPath: string, filePath: string, databaseId: string) => Promise<void>
	setCell: (
		vaultPath: string,
		filePath: string,
		propertyKey: string,
		value: unknown,
	) => Promise<void>
	moveBoardCard: (
		vaultPath: string,
		filePath: string,
		propertyKey: string,
		optionId: string | null,
	) => Promise<void>
	cancelIndexing: () => void
	reset: () => void
}

function isMarkdownPath(filePath: string): boolean {
	return filePath.toLocaleLowerCase().endsWith(".md")
}

function getFileName(filePath: string): string {
	return filePath.split("/").pop() ?? filePath
}

function getRelativePath(vaultPath: string, filePath: string): string {
	return filePath.startsWith(`${vaultPath}/`) ? filePath.slice(vaultPath.length + 1) : filePath
}

function getRelativeFolderSource(vaultPath: string, filePath: string | null): DatabaseSource {
	if (!filePath || !filePath.startsWith(`${vaultPath}/`)) return { kind: "vault" }
	const relativePath = getRelativePath(vaultPath, filePath)
	const folder = relativePath.includes("/") ? relativePath.split("/").slice(0, -1).join("/") : ""
	return folder ? { kind: "folder", path: folder } : { kind: "vault" }
}

function replaceRelativePrefix(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath
	if (!path.startsWith(`${oldPath}/`)) return null
	return `${newPath}${path.slice(oldPath.length)}`
}

function hasDatabases(catalog: DatabaseCatalog): boolean {
	return Object.keys(catalog.databases).length > 0
}

function createFileEntryFromFilePath(
	filePath: string,
	size: number,
	mtime: number,
): DatabaseFileEntry {
	return {
		path: filePath,
		name: getFileName(filePath),
		isDir: false,
		size,
		mtime,
	}
}

function databaseCatalogWithTimestamp(catalog: DatabaseCatalog): DatabaseCatalog {
	return {
		...catalog,
		updatedAt: new Date().toISOString(),
	}
}

async function saveUpdatedCatalog(
	vaultPath: string,
	catalog: DatabaseCatalog,
	setCatalog: (catalog: DatabaseCatalog) => void,
): Promise<DatabaseCatalog> {
	const updated = await updateDatabaseCatalog(vaultPath, databaseCatalogWithTimestamp(catalog))
	setCatalog(updated)
	return updated
}

function createStatusOptions() {
	const first = createPropertyOption("Todo", [], {}, "gray")
	const second = createPropertyOption("Doing", [first], {}, "blue")
	const third = createPropertyOption("Done", [first, second], {}, "green")
	return [first, second, third]
}

export function getDefaultDatabaseSource(
	vaultPath: string,
	filePath: string | null,
): DatabaseSource {
	return getRelativeFolderSource(vaultPath, filePath)
}

export const useDatabaseStore = create<DatabaseState>()(
	devtools(
		(set, get) => ({
			catalog: emptyCatalog,
			index: null,
			loadedVaultPath: null,
			indexing: false,
			error: null,

			loadCatalog: async (vaultPath) => {
				try {
					const catalog = await getDatabaseCatalog(vaultPath)
					set({ catalog, loadedVaultPath: vaultPath, error: null })
					return catalog
				} catch (error) {
					set({ error: String(error) })
					throw error
				}
			},

			saveCatalog: async (vaultPath, catalog) => {
				try {
					return await saveUpdatedCatalog(vaultPath, catalog, (nextCatalog) =>
						set({ catalog: nextCatalog, loadedVaultPath: vaultPath, error: null }),
					)
				} catch (error) {
					set({ error: String(error) })
					throw error
				}
			},

			createDatabase: async (vaultPath, input) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				const entry = createDatabaseCatalogEntry(input)
				await get().saveCatalog(vaultPath, {
					...catalog,
					databases: { ...catalog.databases, [entry.database.id]: entry.database },
					views: { ...catalog.views, [entry.view.id]: entry.view },
				})
				return entry
			},

			updateDatabase: async (vaultPath, databaseId, updates) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				const database = catalog.databases[databaseId]
				if (!database) return null
				const updatedDatabase: DatabaseDefinition = {
					...database,
					...updates,
					updatedAt: new Date().toISOString(),
				}
				await get().saveCatalog(vaultPath, {
					...catalog,
					databases: { ...catalog.databases, [databaseId]: updatedDatabase },
				})
				return updatedDatabase
			},

			createView: async (vaultPath, input) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				if (!catalog.databases[input.databaseId]) {
					throw new Error(`Unknown database "${input.databaseId}"`)
				}
				const view = createDatabaseViewDefinition(input)
				await get().saveCatalog(vaultPath, {
					...catalog,
					views: { ...catalog.views, [view.id]: view },
				})
				return view
			},

			updateView: async (vaultPath, viewId, updates) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				const view = catalog.views[viewId]
				if (!view) return null
				const updatedView: DatabaseViewDefinition = {
					...view,
					...updates,
					updatedAt: new Date().toISOString(),
				}
				await get().saveCatalog(vaultPath, {
					...catalog,
					views: { ...catalog.views, [viewId]: updatedView },
				})
				return updatedView
			},

			updateViewColumns: async (vaultPath, viewId, propertyKeys) => {
				return get().updateView(vaultPath, viewId, {
					visiblePropertyKeys: Array.from(new Set(propertyKeys)),
				})
			},

			addPropertyToDatabase: async (vaultPath, databaseId, viewId, input) => {
				const [catalog, schema] = await Promise.all([
					get().loadedVaultPath === vaultPath
						? Promise.resolve(get().catalog)
						: get().loadCatalog(vaultPath),
					getVaultSchema(vaultPath),
				])
				const database = catalog.databases[databaseId]
				const view = catalog.views[viewId]
				if (!database || !view || view.databaseId !== databaseId) {
					throw new Error("Database view not available")
				}
				const definition = createPropertyDefinition({
					name: input.name,
					type: input.type,
					properties: schema.properties,
					options: input.options,
				})
				await updateVaultSchema(vaultPath, {
					version: 1,
					properties: [...schema.properties, definition],
				})
				const propertyKeys = Array.from(new Set([...database.propertyKeys, definition.key]))
				const visiblePropertyKeys = Array.from(
					new Set([...view.visiblePropertyKeys, definition.key]),
				)
				await get().saveCatalog(vaultPath, {
					...catalog,
					databases: {
						...catalog.databases,
						[databaseId]: {
							...database,
							propertyKeys,
							updatedAt: new Date().toISOString(),
						},
					},
					views: {
						...catalog.views,
						[viewId]: {
							...view,
							visiblePropertyKeys,
							updatedAt: new Date().toISOString(),
						},
					},
				})
				return definition
			},

			updateSelectOption: async (vaultPath, propertyKey, optionId, updates) => {
				const schema = await getVaultSchema(vaultPath)
				const definition = schema.properties.find((property) => property.key === propertyKey)
				if (!definition || getPropertyType(definition.type)?.baseType !== "select") return null
				const updatedDefinition = updatePropertyOption(definition, optionId, updates)
				await updateVaultSchema(vaultPath, {
					version: 1,
					properties: schema.properties.map((property) =>
						property.id === definition.id ? updatedDefinition : property,
					),
				})
				return updatedDefinition
			},

			addSelectOption: async (vaultPath, propertyKey, label = "New option") => {
				const schema = await getVaultSchema(vaultPath)
				const definition = schema.properties.find((property) => property.key === propertyKey)
				if (!definition || getPropertyType(definition.type)?.baseType !== "select") return null
				const options = definition.options ?? []
				const option = createPropertyOption(label, options)
				const updatedDefinition: PropertyDefinition = {
					...definition,
					options: [...options, option],
					optionSort: definition.optionSort ?? "manual",
				}
				await updateVaultSchema(vaultPath, {
					version: 1,
					properties: schema.properties.map((property) =>
						property.id === definition.id ? updatedDefinition : property,
					),
				})
				return updatedDefinition
			},

			ensureBoardStatusProperty: async (vaultPath) => {
				const schema = await getVaultSchema(vaultPath)
				const existingStatus = schema.properties.find(
					(property) =>
						property.key.toLocaleLowerCase() === "status" &&
						getPropertyType(property.type)?.baseType === "select",
				)
				if (existingStatus) return existingStatus
				const existingNamedStatus = schema.properties.find(
					(property) =>
						property.name.toLocaleLowerCase() === "status" &&
						getPropertyType(property.type)?.baseType === "select",
				)
				if (existingNamedStatus) return existingNamedStatus
				const definition = createPropertyDefinition({
					name: "Status",
					type: "select",
					properties: schema.properties,
					options: createStatusOptions(),
				})
				await updateVaultSchema(vaultPath, {
					version: 1,
					properties: [...schema.properties, definition],
				})
				return definition
			},

			buildIndexFromFiles: async (vaultPath, files, force = false) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				if (!force && !hasDatabases(catalog)) return
				const generation = ++databaseIndexGeneration
				set({ indexing: true, error: null })
				try {
					const index = await buildDatabaseIndex(vaultPath, files)
					if (generation !== databaseIndexGeneration) return
					set({ index, indexing: false, error: null })
				} catch (error) {
					if (generation === databaseIndexGeneration) {
						set({ indexing: false, error: String(error) })
					}
				}
			},

			indexFile: async (vaultPath, filePath) => {
				if (!isMarkdownPath(filePath) || !get().index) return
				try {
					const entry = noteCache.getEntry(filePath)
					const file =
						entry !== undefined
							? createFileEntryFromFilePath(filePath, entry.content.length, entry.mtime)
							: await getPlatform()
									.fs.readFileSnapshot(filePath)
									.then((snapshot) =>
										createFileEntryFromFilePath(
											filePath,
											snapshot.content.length,
											snapshot.metadata.modifiedAt,
										),
									)
					const row = await indexDatabaseFile(vaultPath, file)
					if (!row) return
					const index = get().index
					if (!index) return
					set({ index: upsertDatabaseIndexRow(index, row) })
				} catch (error) {
					set({ error: String(error) })
				}
			},

			removeFileFromIndex: (filePath) => {
				const index = get().index
				if (!index) return
				set({ index: removeDatabaseIndexPath(index, filePath) })
			},

			renameFileInIndex: (oldPath, newPath) => {
				const index = get().index
				if (!index) return
				set({ index: renameDatabaseIndexPath(index, oldPath, newPath) })
			},

			renameDatabaseReferences: async (vaultPath, oldPath, newPath) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				const oldRelativePath = getRelativePath(vaultPath, oldPath)
				const newRelativePath = getRelativePath(vaultPath, newPath)
				let changed = false
				const databases = Object.fromEntries(
					Object.entries(catalog.databases).map(([id, database]) => {
						const nextDefaultFolder = database.defaultFolder
							? replaceRelativePrefix(database.defaultFolder, oldRelativePath, newRelativePath)
							: null
						const nextCreatedInNotePath = database.createdInNotePath
							? replaceRelativePrefix(database.createdInNotePath, oldRelativePath, newRelativePath)
							: null
						if (!nextDefaultFolder && !nextCreatedInNotePath) return [id, database]
						changed = true
						return [
							id,
							{
								...database,
								defaultFolder: nextDefaultFolder ?? database.defaultFolder,
								createdInNotePath: nextCreatedInNotePath ?? database.createdInNotePath,
								updatedAt: new Date().toISOString(),
							},
						]
					}),
				)
				if (changed) await get().saveCatalog(vaultPath, { ...catalog, databases })
			},

			queryView: async (vaultPath, databaseId, viewId) => {
				const catalog =
					get().loadedVaultPath === vaultPath ? get().catalog : await get().loadCatalog(vaultPath)
				const database = catalog.databases[databaseId]
				const view = catalog.views[viewId]
				const index = get().index
				if (!database || !view || !index) return null
				const schema = await getVaultSchema(vaultPath)
				return queryDatabaseView({ index, database, view, schema })
			},

			linkNoteToDatabase: async (vaultPath, filePath, databaseId, defaults = {}) => {
				const meta = await getPropertyMap(filePath)
				const membershipIds = getDatabaseMembershipIdsFromMeta(meta)
				if (!membershipIds.includes(databaseId)) {
					await setProperty(filePath, DATABASE_MEMBERSHIP_PROPERTY_KEY, [
						...membershipIds,
						databaseId,
					])
				}
				for (const [propertyKey, value] of Object.entries(defaults)) {
					if (isEmptyPropertyValue(value) || !isEmptyPropertyValue(meta[propertyKey])) continue
					await setProperty(filePath, propertyKey, value)
				}
				await get().indexFile(vaultPath, filePath)
			},

			unlinkNoteFromDatabase: async (vaultPath, filePath, databaseId) => {
				const meta = await getPropertyMap(filePath)
				const nextMembershipIds = getDatabaseMembershipIdsFromMeta(meta).filter(
					(id) => id !== databaseId,
				)
				if (nextMembershipIds.length > 0) {
					await setProperty(filePath, DATABASE_MEMBERSHIP_PROPERTY_KEY, nextMembershipIds)
				} else {
					await removeProperty(filePath, DATABASE_MEMBERSHIP_PROPERTY_KEY)
				}
				await get().indexFile(vaultPath, filePath)
			},

			setCell: async (vaultPath, filePath, propertyKey, value) => {
				if (isEmptyPropertyValue(value)) await removeProperty(filePath, propertyKey)
				else await setProperty(filePath, propertyKey, value)
				await get().indexFile(vaultPath, filePath)
			},

			moveBoardCard: async (vaultPath, filePath, propertyKey, optionId) => {
				await get().setCell(vaultPath, filePath, propertyKey, optionId)
			},

			cancelIndexing: () => {
				databaseIndexGeneration++
				set({ indexing: false })
			},

			reset: () => {
				databaseIndexGeneration++
				set({
					catalog: emptyCatalog,
					index: null,
					loadedVaultPath: null,
					indexing: false,
					error: null,
				})
			},
		}),
		{ name: "databaseStore" },
	),
)

export function isDatabaseCatalogPath(path: string): boolean {
	const normalized = path.replaceAll("\\", "/")
	return normalized === DATABASE_CATALOG_FILE || normalized.endsWith(`/${DATABASE_CATALOG_FILE}`)
}
