import {
	getLinkedRemoteVaultId,
	shareDatabaseTemplate,
	useAuthStore,
	useDatabaseStore,
	useMembersStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { getBaseName } from "@cortex/platform/utils"
import type { DatabaseRow, DatabaseView } from "@cortex/properties/database"

import type {
	ShareGroup,
	SharePreviewRow,
	ShareSubject,
	ShareTemplateInput,
	ShareTemplateOutcome,
} from "@/features/share/shareTypes"

const SAMPLE_LIMIT = 3
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function viewLabel(view: DatabaseView): string {
	if (view.name.trim()) return view.name
	return view.type.charAt(0).toUpperCase() + view.type.slice(1)
}

function collectPropertyKeys(views: DatabaseView[], templateKeys: string[]): number {
	const keys = new Set<string>(templateKeys)
	for (const view of views) {
		for (const key of [
			view.group,
			view.date,
			view.cover,
			...(view.columns ?? []),
			...(view.sort ?? []).map((sort) => sort.key),
			...(view.filters ?? []).map((filter) => filter.key),
		]) {
			if (key && !key.startsWith("$")) keys.add(key)
		}
	}
	return keys.size
}

function metaString(meta: Record<string, unknown>, matcher: RegExp): string {
	for (const [key, value] of Object.entries(meta)) {
		if (!matcher.test(key)) continue
		if (typeof value === "string" && value.trim()) return value
		if (Array.isArray(value) && typeof value[0] === "string") return value[0]
	}
	return ""
}

function shortDate(value: string): string {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) return value
	return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}`
}

function toPreviewRow(row: DatabaseRow): SharePreviewRow {
	const meta = row.meta as Record<string, unknown>
	return {
		date: shortDate(metaString(meta, /due|date|when/iu)),
		status: metaString(meta, /status|state|stage/iu) || "In progress",
		title: row.title,
	}
}

function ownerName(): string {
	const user = useAuthStore.getState().user
	return user?.displayName || user?.email || "You"
}

export function loadShareSubject(folderPath: string | undefined): ShareSubject {
	const store = useDatabaseStore.getState()
	const entry = folderPath ? store.databases[folderPath] : undefined
	if (!entry) {
		return {
			description: "",
			folderPath: folderPath ?? null,
			name: folderPath ? getBaseName(folderPath) : "Database",
			ownerName: ownerName(),
			previewRows: [],
			propertyCount: 0,
			rowTemplateNames: [],
			sampleCount: 0,
			viewNames: [],
		}
	}
	const rows = Object.values(store.rowsByFolder[entry.folderPath]?.rows ?? {}).sort(
		(left, right) => right.mtime - left.mtime,
	)
	const templates = entry.config.templates ?? []
	const previewRows = rows.slice(0, 2).map(toPreviewRow)
	return {
		description: entry.description,
		folderPath: entry.folderPath,
		name: entry.name,
		ownerName: ownerName(),
		previewRows,
		propertyCount: collectPropertyKeys(
			entry.config.views,
			templates.flatMap((template) => Object.keys(template.properties ?? {})),
		),
		rowTemplateNames: templates.map((template) => template.name),
		sampleCount: Math.min(SAMPLE_LIMIT, rows.length),
		viewNames: entry.config.views.map(viewLabel),
	}
}

export function loadShareGroups(vaultName: string): ShareGroup[] {
	const { groups, members } = useMembersStore.getState()
	return [
		...groups.map((group) => ({
			id: group.id,
			memberCount: group.memberIds.length,
			name: group.name,
		})),
		{ id: null, memberCount: members.length, name: `Everyone in ${vaultName}` },
	]
}

export async function publishTemplate(
	input: ShareTemplateInput,
	groupName: string | null,
): Promise<ShareTemplateOutcome> {
	const vault = useVaultStore.getState().vault
	if (!vault || !input.subject.folderPath) throw new Error("Choose a database to share.")
	if (getLinkedRemoteVaultId() === null) throw new Error("Link this vault to share templates.")
	const info = await shareDatabaseTemplate(vault, input.subject.folderPath, input.name, {
		audience: input.audience,
		description: input.description,
		groupId: input.groupId,
		includeSamples: input.includeSamples,
	})
	return {
		audience: info.audience,
		groupName: info.groupName ?? groupName,
		link: info.link,
		name: info.name,
	}
}

export async function copyShareLink(link: string): Promise<void> {
	await getPlatform().clipboard.writeText(link)
}
