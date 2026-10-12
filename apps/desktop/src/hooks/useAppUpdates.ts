import type { VaultMetadata } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useEffect, useRef } from "react"
import {
	readLastSeenAppVersion,
	writeLastSeenAppVersion,
} from "../features/app-updates/appUpdateChangelogMarker"
import { checkForAppUpdate, refreshAppUpdateStatus } from "../features/app-updates/appUpdateStore"
import { openChangelogTab } from "../features/app-updates/openChangelog"
import { sendCoreNotification } from "../utils/nativeNotifications"

export function useAppUpdateLifecycle(version: string | null, vault: VaultMetadata | null) {
	const startupCheckAttempted = useRef(false)
	const handledChangelogVersions = useRef<Set<string> | null>(null)
	handledChangelogVersions.current ??= new Set()

	useEffect(() => {
		if (!version || startupCheckAttempted.current) return
		startupCheckAttempted.current = true
		void getPlatform()
			.window.claimOnce("app-update-startup-check")
			.then((claimed) => {
				if (claimed) void checkForAppUpdate("startup")
			})
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
			if (!(await getPlatform().window.claimOnce(`app-update-changelog:${version}`))) return

			const opened = await openChangelogTab(version)
			if (cancelled) return

			void sendCoreNotification({
				id: `app-updated:${version}`,
				tag: "app-update",
				title: `Cortex updated to v${version}`,
				body: opened ? "Release notes are open in Cortex." : undefined,
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
	}, [vault, version])
}
