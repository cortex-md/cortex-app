import {
	getLinkedRemoteVaultId,
	shareDatabaseTemplate,
	useAuthStore,
	useDatabaseStore,
	useMembersStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import type { DatabaseRow, DatabaseView } from "@cortex/properties/database"

import {
	FIXTURE_OWNER,
	FIXTURE_SITE,
	fixturePreviewRows,
	fixtureShareGroups,
	fixtureShareSubject,
	slugify,
} from "@/features/share/shareFixtures"
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
	return useAuthStore.getState().user?.displayName || FIXTURE_OWNER
}

export function loadShareSubject(folderPath: string | undefined): ShareSubject {
	// stub: without a loaded database the "Projects" fixture stands in for the listing
	const store = useDatabaseStore.getState()
	const entry = folderPath ? store.databases[folderPath] : undefined
	if (!entry) return { ...fixtureShareSubject, ownerName: ownerName() }
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
		previewRows: previewRows.length > 0 ? previewRows : fixturePreviewRows,
		propertyCount: collectPropertyKeys(
			entry.config.views,
			templates.flatMap((template) => Object.keys(template.properties ?? {})),
		),
		rowTemplateNames: templates.map((template) => template.name),
		sampleCount: Math.min(SAMPLE_LIMIT, rows.length) || SAMPLE_LIMIT,
		viewNames: entry.config.views.map(viewLabel),
	}
}

export function loadShareGroups(vaultName: string): ShareGroup[] {
	// stub: team groups come from the fixture until the vault is linked to a sync server
	const remoteVaultId = getLinkedRemoteVaultId()
	const { groups, members } = useMembersStore.getState()
	if (!remoteVaultId || groups.length === 0) return fixtureShareGroups(vaultName)
	return [
		...groups.map((group) => ({ id: group.id, memberCount: group.memberIds.length, name: group.name })),
		{ id: null, memberCount: members.length, name: `Everyone in ${vaultName}` },
	]
}

function fixtureOutcome(input: ShareTemplateInput, groupName: string | null): ShareTemplateOutcome {
	return {
		audience: input.audience,
		groupName,
		link: input.audience === "team" ? null : `${FIXTURE_SITE}/t/${slugify(input.name)}`,
		name: input.name,
		stub: true,
	}
}

export async function publishTemplate(
	input: ShareTemplateInput,
	groupName: string | null,
): Promise<ShareTemplateOutcome> {
	// stub: the share API is unavailable on mobile, so publishing resolves to a fixture link
	const vault = useVaultStore.getState().vault
	const canPublish =
		Boolean(vault && input.subject.folderPath && getPlatform().templateShares) &&
		getLinkedRemoteVaultId() !== null
	if (!vault || !input.subject.folderPath || !canPublish) return fixtureOutcome(input, groupName)
	try {
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
			stub: false,
		}
	} catch {
		return fixtureOutcome(input, groupName)
	}
}

export async function copyShareLink(link: string): Promise<void> {
	await getPlatform().clipboard.writeText(link)
}
