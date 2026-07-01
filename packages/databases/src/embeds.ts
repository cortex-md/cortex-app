import {
	parseFrontmatter,
	removeFrontmatterValue,
	setFrontmatterValue,
} from "@cortex/properties"
import { DATABASE_MEMBERSHIP_PROPERTY_KEY, type DatabaseEmbedMarker } from "./types"

const databaseEmbedPattern =
	/^\s*\{\{database:([A-Za-z0-9_-]+)#([A-Za-z0-9_-]+)\}\}\s*$/

function normalizeMembershipIds(value: unknown): string[] {
	const ids = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
	return Array.from(
		new Set(ids.flatMap((id) => (typeof id === "string" && id.trim() ? [id.trim()] : []))),
	)
}

export function parseDatabaseEmbedMarker(line: string): DatabaseEmbedMarker | null {
	const match = databaseEmbedPattern.exec(line)
	if (!match) return null
	return {
		databaseId: match[1],
		viewId: match[2],
	}
}

export function serializeDatabaseEmbedMarker(marker: DatabaseEmbedMarker): string {
	return `{{database:${marker.databaseId}#${marker.viewId}}}`
}

export function getDatabaseMembershipIdsFromMeta(meta: Record<string, unknown>): string[] {
	return normalizeMembershipIds(meta[DATABASE_MEMBERSHIP_PROPERTY_KEY])
}

export function getDatabaseMembershipIds(rawContent: string): string[] {
	return getDatabaseMembershipIdsFromMeta(parseFrontmatter(rawContent).meta)
}

export function addDatabaseMembershipId(rawContent: string, databaseId: string): string {
	const ids = getDatabaseMembershipIds(rawContent)
	if (ids.includes(databaseId)) return rawContent
	return setFrontmatterValue(rawContent, DATABASE_MEMBERSHIP_PROPERTY_KEY, [...ids, databaseId])
}

export function removeDatabaseMembershipId(rawContent: string, databaseId: string): string {
	const ids = getDatabaseMembershipIds(rawContent).filter((id) => id !== databaseId)
	return ids.length > 0
		? setFrontmatterValue(rawContent, DATABASE_MEMBERSHIP_PROPERTY_KEY, ids)
		: removeFrontmatterValue(rawContent, DATABASE_MEMBERSHIP_PROPERTY_KEY)
}
