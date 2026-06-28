import { useWorkspaceStore, type VaultMetadata } from "@cortex/core"
import { useEffect, useRef } from "react"
import {
	readLastSeenAppVersion,
	writeLastSeenAppVersion,
} from "../features/app-updates/appUpdateChangelogMarker"
import {
	checkForAppUpdate,
	fetchAppUpdateChangelog,
	refreshAppUpdateStatus,
} from "../features/app-updates/appUpdateStore"
import { sendCoreNotification } from "../utils/nativeNotifications"

function normalizeChangelogContent(version: string, content: string): string {
	const trimmed = content.trim()
	if (trimmed.startsWith("#")) return trimmed
	return `# What's new in Cortex v${version}\n\n${trimmed}`
}

export function useAppUpdateLifecycle(version: string | null, vault: VaultMetadata | null) {
	const startupCheckAttempted = useRef(false)
	const handledChangelogVersions = useRef<Set<string> | null>(null)
	handledChangelogVersions.current ??= new Set()
	const openViewTab = useWorkspaceStore((state) => state.openViewTab)

	useEffect(() => {
		if (!version || startupCheckAttempted.current) return
		startupCheckAttempted.current = true
		void checkForAppUpdate("startup")
	}, [version])

	useEffect(() => {
		void refreshAppUpdateStatus()
	}, [])

	useEffect(() => {
		if (!version || !vault) return
		if (handledChangelogVersions.current?.has(version)) return
		let cancelled = false
		handledChangelogVersions.current?.add(version)

		const openChangelog = async () => {
			const lastSeenVersion = await readLastSeenAppVersion()
			if (cancelled || lastSeenVersion === version) return

			const changelog = await fetchAppUpdateChangelog(version)
			if (cancelled) return

			if (changelog) {
				openViewTab("app-update-changelog", `What's new in v${version}`, {
					ephemeral: true,
					viewState: {
						version,
						content: normalizeChangelogContent(version, changelog),
					},
				})
			}

			void sendCoreNotification({
				id: `app-updated:${version}`,
				tag: "app-update",
				title: `Cortex updated to v${version}`,
				body: changelog ? "Release notes are open in Cortex." : undefined,
				kind: "success",
				urgency: "normal",
			})

			try {
				await writeLastSeenAppVersion(version)
			} catch (error) {
				console.error("[App update changelog marker write failed]", { version, error })
			}
		}

		void openChangelog().catch((error) => {
			console.error("[App update changelog handling failed]", { version, error })
		})

		return () => {
			cancelled = true
		}
	}, [openViewTab, vault, version])
}
