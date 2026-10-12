import { useWorkspaceStore } from "@cortex/core"
import { fetchAppUpdateChangelog } from "./appUpdateStore"

function normalizeChangelogContent(version: string, content: string): string {
	const trimmed = content.trim()
	if (trimmed.startsWith("#")) return trimmed
	return `# What's new in Cortex v${version}\n\n${trimmed}`
}

export async function openChangelogTab(version: string): Promise<boolean> {
	const changelog = await fetchAppUpdateChangelog(version)
	if (!changelog) return false
	useWorkspaceStore.getState().openViewTab("app-update-changelog", `What's new in v${version}`, {
		ephemeral: true,
		viewState: { version, content: normalizeChangelogContent(version, changelog) },
	})
	return true
}
