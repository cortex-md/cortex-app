import { getPlatform } from "@cortex/platform"
import { fetchLatestRelease } from "./registryService"
import type { RegistryEntry } from "./types"
import { compareVersions } from "./versionUtils"

export async function readInstalledVersion(id: string, dir: string): Promise<string | null> {
	try {
		const raw = await getPlatform().fs.readFile(`${dir}/${id}/manifest.json`)
		const manifest = JSON.parse(raw) as { version?: string }
		return manifest.version ?? null
	} catch {
		return null
	}
}

export async function detectAvailableUpdates(
	entries: RegistryEntry[],
	installedIds: string[],
	dir: string,
): Promise<Record<string, string>> {
	const installedEntries = entries.filter((e) => installedIds.includes(e.id))

	const results = await Promise.allSettled(
		installedEntries.map(async (entry) => {
			const installedVersion = await readInstalledVersion(entry.id, dir)
			if (!installedVersion) return null

			const release = await fetchLatestRelease(entry.repo)
			const latestVersion = release.tag_name.replace(/^v/, "")

			if (compareVersions(latestVersion, installedVersion) > 0) {
				return { id: entry.id, latestVersion }
			}
			return null
		}),
	)

	const updates: Record<string, string> = {}
	for (const result of results) {
		if (result.status === "fulfilled" && result.value) {
			updates[result.value.id] = result.value.latestVersion
		}
	}
	return updates
}
