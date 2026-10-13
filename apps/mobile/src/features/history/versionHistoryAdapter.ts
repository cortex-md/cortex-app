import {
	buildDiffRows,
	countWordChanges,
	type DiffRow,
	historyDayLabel,
	listLocalVersions,
	readCurrentNoteContent,
	readLocalVersion,
	restoreLocalVersion,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { getBaseName, getParentPath } from "@cortex/platform/utils"

import {
	FIXTURE_HISTORY_NOTE_NAME,
	FIXTURE_VERSIONS,
	type FixtureVersion,
} from "@/features/history/historyFixtures"
import { CURRENT_DEVICE_NAME } from "@/features/sync/syncFixtures"

const MINUTE_MS = 60_000

export type VersionSource = "current" | "local" | "fixture"

export interface VersionEntry {
	id: string
	title: string
	who: string
	device: string
	isMine: boolean
	isCurrent: boolean
	timestamp: number
	added: number
	removed: number
	source: VersionSource
	content: string
	previousContent: string
}

export interface VersionHistory {
	noteName: string
	versions: VersionEntry[]
	usesFixtures: boolean
}

export interface VersionDayGroup {
	label: string
	versions: VersionEntry[]
}

export type DeviceFilter = "all" | "device" | "others"

function withStats(
	entries: Omit<VersionEntry, "added" | "removed" | "previousContent">[],
): VersionEntry[] {
	return entries.map((entry, index) => {
		const previousContent = entries[index + 1]?.content ?? ""
		const { added, removed } = countWordChanges(previousContent, entry.content)
		return { ...entry, added, removed, previousContent }
	})
}

function fixtureEntries(now: number): VersionEntry[] {
	return withStats(
		FIXTURE_VERSIONS.map((version: FixtureVersion, index) => ({
			id: version.id,
			title: version.title,
			who: version.who,
			device: version.device,
			isMine: version.isMine,
			isCurrent: index === 0,
			timestamp: now - version.minutesAgo * MINUTE_MS,
			source: index === 0 ? "current" : "fixture",
			content: version.content,
		})),
	)
}

async function loadLocalEntries(filePath: string, now: number): Promise<VersionEntry[]> {
	const versions = await listLocalVersions(filePath)
	if (versions.length === 0) return []
	const [current, ...contents] = await Promise.all([
		readCurrentNoteContent(filePath),
		...versions.map((version) => readLocalVersion(filePath, version.id)),
	])
	const total = versions.length
	return withStats([
		{
			id: "current",
			title: "Current version",
			who: "You",
			device: CURRENT_DEVICE_NAME,
			isMine: true,
			isCurrent: true,
			timestamp: now,
			source: "current",
			content: current ?? "",
		},
		...versions.map((version, index) => ({
			id: version.id,
			title: `Version ${total - index}`,
			who: "You",
			device: CURRENT_DEVICE_NAME,
			isMine: true,
			isCurrent: false,
			timestamp: version.timestamp,
			source: "local" as const,
			content: contents[index] ?? "",
		})),
	])
}

export async function loadVersionHistory(filePath: string | null): Promise<VersionHistory> {
	// stub: remote versions with author and device come from the sync server; fixtures fill in until then
	const now = Date.now()
	if (filePath) {
		const local = await loadLocalEntries(filePath, now).catch(() => [])
		if (local.length > 0) {
			return { noteName: getBaseName(filePath), versions: local, usesFixtures: false }
		}
	}
	return {
		noteName: filePath ? getBaseName(filePath) : FIXTURE_HISTORY_NOTE_NAME,
		versions: fixtureEntries(now),
		usesFixtures: true,
	}
}

export function filterVersions(
	versions: readonly VersionEntry[],
	filter: DeviceFilter,
): VersionEntry[] {
	if (filter === "all") return [...versions]
	return versions.filter((version) => (filter === "device" ? version.isMine : !version.isMine))
}

export function groupVersionsByDay(versions: readonly VersionEntry[]): VersionDayGroup[] {
	const now = Date.now()
	const groups: VersionDayGroup[] = []
	for (const version of versions) {
		const label = historyDayLabel(version.timestamp, now)
		const last = groups.at(-1)
		if (last?.label === label) last.versions.push(version)
		else groups.push({ label, versions: [version] })
	}
	return groups
}

export function formatVersionTime(timestamp: number): string {
	const label = historyDayLabel(timestamp)
	const date = new Date(timestamp)
	if (label === "Earlier") {
		return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
	}
	return date.toLocaleTimeString(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" })
}

export function formatVersionMoment(timestamp: number): string {
	const label = historyDayLabel(timestamp)
	const date = new Date(timestamp)
	const time = date.toLocaleTimeString(undefined, {
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
	})
	if (label === "Earlier") {
		return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${time}`
	}
	return `${label} at ${time}`
}

export function getVersionDiff(version: VersionEntry): DiffRow[] {
	return buildDiffRows(version.previousContent, version.content)
}

export async function restoreVersion(
	filePath: string | null,
	version: VersionEntry,
): Promise<void> {
	if (version.isCurrent) return
	if (version.source === "local" && filePath) {
		await restoreLocalVersion(filePath, version.id)
		return
	}
	// stub: remote versions cannot be restored until the sync engine runs on mobile
}

export async function copyVersionText(version: VersionEntry): Promise<void> {
	await getPlatform().clipboard.writeText(version.content)
}

export function versionCopyName(noteName: string, version: VersionEntry): string {
	return `${noteName.replace(/\.md$/i, "")} (${version.title})`
}

export async function openVersionAsCopy(
	filePath: string | null,
	noteName: string,
	version: VersionEntry,
): Promise<string> {
	const vaultPath = useVaultStore.getState().vault?.path
	const parentPath = filePath ? getParentPath(filePath) : (vaultPath ?? "")
	return useVaultStore
		.getState()
		.createFileWithContent(parentPath, versionCopyName(noteName, version), version.content)
}
