import { executeCommand } from "@cortex/commands"
import { useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useCallback, useEffect } from "react"
import { reportAppError } from "../utils/reportAppError"

type NativeMenuAction = () => Promise<void> | void

export function useNativeMenuEvents(): void {
	const vault = useVaultStore((state) => state.vault)
	const openVault = useVaultStore((state) => state.openVault)
	const closeVault = useVaultStore((state) => state.closeVault)

	const runNativeMenuAction = useCallback((operation: string, action: NativeMenuAction) => {
		Promise.resolve()
			.then(action)
			.catch((error) => {
				void reportAppError({
					operation,
					source: "native-menu",
					cause: error,
				})
			})
	}, [])

	useEffect(() => {
		const switchVault = async (vaultPath: string) => {
			if (vaultPath === vault?.path) return
			await closeVault()
			await openVault(vaultPath)
		}

		const app = getPlatform().app
		const subscriptions = [
			app.onNativeEvent<string>("dock-open-vault", (vaultPath) => {
				if (!vaultPath) return
				runNativeMenuAction("open-dock-vault", () => switchVault(vaultPath))
			}),
			app.onNativeEvent("menu-new-note", () => {
				if (!vault) return
				runNativeMenuAction("create-menu-note", () => {
					executeCommand("file.new", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-open-vault", () => {
				runNativeMenuAction("open-menu-vault", () => {
					executeCommand("vault.open", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-close-vault", () => {
				runNativeMenuAction("close-menu-vault", () => {
					executeCommand("vault.close", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-open-settings", () => {
				runNativeMenuAction("open-menu-settings", () => {
					executeCommand("app.settings", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-toggle-sidebar", () => {
				runNativeMenuAction("toggle-menu-sidebar", () => {
					executeCommand("view.toggle-sidebar", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-search-vault", () => {
				runNativeMenuAction("search-menu-vault", () => {
					executeCommand("view.search", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-command-palette", () => {
				runNativeMenuAction("open-menu-command-palette", () => {
					executeCommand("navigate.command-palette", { source: "menu" })
				})
			}),
			app.onNativeEvent("menu-toggle-theme", () => {
				runNativeMenuAction("toggle-menu-theme", () => {
					executeCommand("view.toggle-theme", { source: "menu" })
				})
			}),
			app.onNativeEvent<string>("menu-recent-vault", (vaultPath) => {
				if (!vaultPath) return
				runNativeMenuAction("open-recent-vault", () => switchVault(vaultPath))
			}),
		]

		const cleanups = subscriptions.map((subscription) =>
			subscription.catch((error) => {
				void reportAppError({
					operation: "register-native-menu-listener",
					source: "native-menu",
					cause: error,
				})
				return null
			}),
		)

		return () => {
			for (const cleanup of cleanups) {
				void cleanup.then((unlisten) => unlisten?.())
			}
		}
	}, [closeVault, openVault, runNativeMenuAction, vault])
}
