import { executeCommand } from "@cortex/commands"
import { useVaultStore } from "@cortex/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
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
		const listenerPromises: Promise<UnlistenFn | null>[] = [
			listen<string>("dock-open-vault", (event) => {
				if (!event.payload) return
				runNativeMenuAction("open-dock-vault", () => switchVault(event.payload))
			}),
			listen("menu-new-note", () => {
				if (!vault) return
				runNativeMenuAction("create-menu-note", () => {
					executeCommand("file.new", { source: "menu" })
				})
			}),
			listen("menu-open-vault", () => {
				runNativeMenuAction("open-menu-vault", () => {
					executeCommand("vault.open", { source: "menu" })
				})
			}),
			listen("menu-close-vault", () => {
				runNativeMenuAction("close-menu-vault", () => {
					executeCommand("vault.close", { source: "menu" })
				})
			}),
			listen("menu-open-settings", () => {
				runNativeMenuAction("open-menu-settings", () => {
					executeCommand("app.settings", { source: "menu" })
				})
			}),
			listen("menu-toggle-sidebar", () => {
				runNativeMenuAction("toggle-menu-sidebar", () => {
					executeCommand("view.toggle-sidebar", { source: "menu" })
				})
			}),
			listen("menu-search-vault", () => {
				runNativeMenuAction("search-menu-vault", () => {
					executeCommand("view.search", { source: "menu" })
				})
			}),
			listen("menu-command-palette", () => {
				runNativeMenuAction("open-menu-command-palette", () => {
					executeCommand("navigate.command-palette", { source: "menu" })
				})
			}),
			listen("menu-toggle-theme", () => {
				runNativeMenuAction("toggle-menu-theme", () => {
					executeCommand("view.toggle-theme", { source: "menu" })
				})
			}),
			listen<string>("menu-recent-vault", (event) => {
				if (!event.payload) return
				runNativeMenuAction("open-recent-vault", () => switchVault(event.payload))
			}),
		].map((listenerPromise) =>
			listenerPromise.catch((error) => {
				void reportAppError({
					operation: "register-native-menu-listener",
					source: "native-menu",
					cause: error,
				})
				return null
			}),
		)

		return () => {
			for (const listenerPromise of listenerPromises) {
				void listenerPromise.then((unlisten) => unlisten?.())
			}
		}
	}, [closeVault, openVault, runNativeMenuAction, vault])
}
