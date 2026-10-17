import { compareVersions } from "../versionUtils"

export type ExtensionSyncKind = "plugins" | "themes"

export const EXTENSION_MANIFEST_VERSION = 1

export interface SyncedExtension {
	id: string
	version: string | null
	enabled?: boolean
	bundled?: true
}

export interface LocalExtension {
	id: string
	version: string | null
	enabled?: boolean
	community: boolean
}

export interface LocalExtensionView {
	items: readonly LocalExtension[]
	communityVisible: boolean
}

export interface ExtensionSyncMemoryView {
	known: readonly string[]
	approved?: readonly string[]
}

export interface DerivedManifest {
	items: SyncedExtension[]
	known: string[]
	approved: string[]
}

export interface ReconcilePlan {
	install: SyncedExtension[]
	update: SyncedExtension[]
	uninstall: string[]
	enable: string[]
	disable: string[]
	awaitingApproval: string[]
	communityOff: string[]
	unavailable: string[]
}

function byId(left: { id: string }, right: { id: string }): number {
	return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

function toSynced(
	kind: ExtensionSyncKind,
	item: LocalExtension,
	carried: SyncedExtension | undefined,
): SyncedExtension {
	const broken = item.version === null && carried !== undefined
	const synced: SyncedExtension = { id: item.id, version: item.version ?? carried?.version ?? null }
	if (kind === "plugins") synced.enabled = broken ? carried.enabled === true : item.enabled === true
	if (!item.community) synced.bundled = true
	return synced
}

export function deriveManifest(
	kind: ExtensionSyncKind,
	current: readonly SyncedExtension[] | null,
	local: LocalExtensionView,
	memory: ExtensionSyncMemoryView,
): DerivedManifest {
	const localById = new Map(local.items.map((item) => [item.id, item]))
	const currentById = new Map((current ?? []).map((item) => [item.id, item]))
	const known = new Set(memory.known)
	const items: SyncedExtension[] = []
	for (const item of local.items) items.push(toSynced(kind, item, currentById.get(item.id)))
	for (const carried of current ?? []) {
		if (localById.has(carried.id)) continue
		const hiddenHere = !carried.bundled && !local.communityVisible
		if (carried.bundled || hiddenHere || !known.has(carried.id)) items.push({ ...carried })
	}
	items.sort(byId)
	const nextKnown = new Set(
		local.items.flatMap((item) => (item.community || kind === "themes" ? [item.id] : [])),
	)
	if (!local.communityVisible) {
		for (const id of known) if (!localById.has(id)) nextKnown.add(id)
	}
	const approved = new Set(memory.approved ?? [])
	for (const item of local.items) if (item.community && item.enabled) approved.add(item.id)
	return { items, known: [...nextKnown].sort(), approved: [...approved].sort() }
}

export function planReconcile(
	kind: ExtensionSyncKind,
	remote: readonly SyncedExtension[],
	local: LocalExtensionView,
	memory: ExtensionSyncMemoryView,
): ReconcilePlan {
	const plan: ReconcilePlan = {
		install: [],
		update: [],
		uninstall: [],
		enable: [],
		disable: [],
		awaitingApproval: [],
		communityOff: [],
		unavailable: [],
	}
	const localById = new Map(local.items.map((item) => [item.id, item]))
	const remoteIds = new Set(remote.map((item) => item.id))
	const approved = new Set(memory.approved ?? [])
	const canEnable = (id: string, bundled: boolean) => bundled || approved.has(id)

	for (const item of remote) {
		const present = localById.get(item.id)
		const bundled = item.bundled === true || present?.community === false
		if (!present) {
			if (bundled) {
				plan.unavailable.push(item.id)
				continue
			}
			if (!local.communityVisible) {
				plan.communityOff.push(item.id)
				continue
			}
			plan.install.push(item)
			if (kind === "plugins" && item.enabled) {
				if (canEnable(item.id, false)) plan.enable.push(item.id)
				else plan.awaitingApproval.push(item.id)
			}
			continue
		}
		if (
			!bundled &&
			item.version &&
			present.version &&
			compareVersions(item.version, present.version) > 0
		) {
			plan.update.push(item)
		}
		if (kind !== "plugins") continue
		if (item.enabled && !present.enabled) {
			if (canEnable(item.id, bundled)) plan.enable.push(item.id)
			else plan.awaitingApproval.push(item.id)
		} else if (!item.enabled && present.enabled) {
			plan.disable.push(item.id)
		}
	}

	const known = new Set(memory.known)
	if (local.communityVisible || kind === "themes") {
		for (const item of local.items) {
			if (remoteIds.has(item.id) || !known.has(item.id)) continue
			if (item.community || kind === "themes") plan.uninstall.push(item.id)
		}
	}
	return plan
}

export interface SyncSummary {
	inSync: number
	unavailable: string[]
	awaitingApproval: string[]
	communityOff: string[]
	failed: string[]
}

export function summarizeSync(
	kind: ExtensionSyncKind,
	manifest: readonly SyncedExtension[],
	local: LocalExtensionView,
	memory: ExtensionSyncMemoryView,
	issues: { unavailable: ReadonlySet<string>; failed: ReadonlySet<string> },
): SyncSummary {
	const summary: SyncSummary = {
		inSync: 0,
		unavailable: [],
		awaitingApproval: [],
		communityOff: [],
		failed: [],
	}
	const localById = new Map(local.items.map((item) => [item.id, item]))
	const approved = new Set(memory.approved ?? [])
	for (const item of manifest) {
		const present = localById.get(item.id)
		if (!present) {
			if (item.bundled || issues.unavailable.has(item.id)) summary.unavailable.push(item.id)
			else if (!local.communityVisible) summary.communityOff.push(item.id)
			else summary.failed.push(item.id)
			continue
		}
		if (
			kind === "plugins" &&
			item.enabled &&
			!present.enabled &&
			present.community &&
			!approved.has(item.id)
		) {
			summary.awaitingApproval.push(item.id)
			continue
		}
		if (issues.failed.has(item.id)) summary.failed.push(item.id)
		else summary.inSync++
	}
	return summary
}

export function serializeManifest(kind: ExtensionSyncKind, items: readonly SyncedExtension[]) {
	return JSON.stringify({ version: EXTENSION_MANIFEST_VERSION, [kind]: items })
}

export function parseManifestItems(
	kind: ExtensionSyncKind,
	raw: Record<string, unknown>,
): SyncedExtension[] {
	const list = raw[kind]
	if (!Array.isArray(list)) return []
	const seen = new Set<string>()
	const items: SyncedExtension[] = []
	for (const value of list) {
		if (!value || typeof value !== "object") continue
		const record = value as Record<string, unknown>
		if (typeof record.id !== "string" || !record.id || seen.has(record.id)) continue
		seen.add(record.id)
		const item: SyncedExtension = {
			id: record.id,
			version: typeof record.version === "string" ? record.version : null,
		}
		if (kind === "plugins") item.enabled = record.enabled === true
		if (record.bundled === true) item.bundled = true
		items.push(item)
	}
	return items.sort(byId)
}
