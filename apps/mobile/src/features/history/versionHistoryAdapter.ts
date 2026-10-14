import {
	buildDiffRows,
	captureCurrentNoteVersion,
	countWordChanges,
	type DiffRow,
	historyDayLabel,
	listLocalVersions,
	readCurrentNoteContent,
	readLocalVersion,
	restoreLocalVersion,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform, type VersionInfo } from "@cortex/platform"
import { getBaseName, getParentPath, toVaultRelativePath } from "@cortex/platform/utils"

import { CURRENT_DEVICE_NAME } from "@/features/sync/syncTypes"

const SERVER_VERSION_LIMIT = 20
const DOWNLOAD_CONCURRENCY = 4

export type VersionSource = "current" | "local" | "server"

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
	serverVersion?: number
}

export interface VersionHistory {
	noteName: string
	versions: VersionEntry[]
}

export interface VersionDayGroup {
	label: string
	versions: VersionEntry[]
}

export type DeviceFilter = "all" | "device" | "others"

function withStats(entries: BaseEntry[]): VersionEntry[] {
	return entries.map((entry, index) => {
		const previousContent = entries[index + 1]?.content ?? ""
		const { added, removed } = countWordChanges(previousContent, entry.content)
		return { ...entry, added, removed, previousContent }
	})
}

type BaseEntry = Omit<VersionEntry, "added" | "removed" | "previousContent">

const serverContentCache = new Map<string, string>()

interface ServerTarget {
	vaultId: string
	vaultPath: string
	relativePath: string
}

function serverTarget(filePath: string): ServerTarget | null {
	const vaultPath = useVaultStore.getState().vault?.path
	const vaultId = useRemoteVaultStore.getState().linkedVaultId
	if (!vaultPath || !vaultId) return null
	const relativePath = toVaultRelativePath(filePath, vaultPath)
	return relativePath ? { vaultId, vaultPath, relativePath } : null
}

async function downloadServerContent(target: ServerTarget, version: number): Promise<string> {
	const key = `${target.vaultId}:${target.relativePath}:${version}`
	const cached = serverContentCache.get(key)
	if (cached !== undefined) return cached
	const content = await useSyncStore
		.getState()
		.downloadVersion(target.vaultId, target.vaultPath, target.relativePath, String(version))
	serverContentCache.set(key, content)
	return content
}

async function mapLimited<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>) {
	const results = new Array<R>(items.length)
	let next = 0
	const worker = async () => {
		while (next < items.length) {
			const index = next++
			results[index] = await run(items[index] as T)
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
	return results
}

async function loadServerEntries(filePath: string): Promise<BaseEntry[]> {
	const target = serverTarget(filePath)
	if (!target) return []
	const [versions, deviceId] = await Promise.all([
		useSyncStore
			.getState()
			.getVersionHistory(target.vaultId, target.vaultPath, target.relativePath),
		getPlatform().device.getDeviceId(),
	])
	const recent = [...versions]
		.sort((left, right) => right.version - left.version)
		.slice(0, SERVER_VERSION_LIMIT)
	const contents = await mapLimited(recent, DOWNLOAD_CONCURRENCY, (version) =>
		downloadServerContent(target, version.version).catch(() => ""),
	)
	return recent.map((version: VersionInfo, index) => {
		const isMine = version.deviceId === deviceId
		return {
			id: `server-${version.version}`,
			title: `Version ${version.version}`,
			who: isMine ? "You" : (version.authorName ?? "Someone"),
			device: isMine ? CURRENT_DEVICE_NAME : (version.deviceName ?? "Another device"),
			isMine,
			isCurrent: false,
			timestamp: version.createdAt ? Date.parse(version.createdAt) : 0,
			source: "server" as const,
			content: contents[index] ?? "",
			serverVersion: version.version,
		}
	})
}

async function loadLocalEntries(filePath: string): Promise<BaseEntry[]> {
	const versions = await listLocalVersions(filePath)
	const contents = await Promise.all(
		versions.map((version) => readLocalVersion(filePath, version.id)),
	)
	const total = versions.length
	return versions.map((version, index) => ({
		id: version.id,
		title: `Local version ${total - index}`,
		who: "You",
		device: CURRENT_DEVICE_NAME,
		isMine: true,
		isCurrent: false,
		timestamp: version.timestamp,
		source: "local" as const,
		content: contents[index] ?? "",
	}))
}

export async function loadVersionHistory(filePath: string | null): Promise<VersionHistory> {
	if (!filePath) return { noteName: "", versions: [] }
	const [current, local, server] = await Promise.all([
		readCurrentNoteContent(filePath).catch(() => ""),
		loadLocalEntries(filePath).catch(() => []),
		loadServerEntries(filePath).catch(() => []),
	])
	const history = [...local, ...server].sort((left, right) => right.timestamp - left.timestamp)
	return {
		noteName: getBaseName(filePath),
		versions: withStats([
			{
				id: "current",
				title: "Current version",
				who: "You",
				device: CURRENT_DEVICE_NAME,
				isMine: true,
				isCurrent: true,
				timestamp: Date.now(),
				source: "current",
				content: current ?? "",
			},
			...history,
		]),
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
	if (!filePath) return
	if (version.source === "local") {
		await restoreLocalVersion(filePath, version.id)
		return
	}
	const target = serverTarget(filePath)
	if (version.source !== "server" || version.serverVersion === undefined || !target) return
	await captureCurrentNoteVersion(filePath, "restore")
	await useSyncStore
		.getState()
		.restoreVersion(
			target.vaultId,
			target.vaultPath,
			target.relativePath,
			String(version.serverVersion),
		)
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
