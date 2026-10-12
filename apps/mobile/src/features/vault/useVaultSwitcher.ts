import {
	getRegistryOpenOptions,
	openVaultSession,
	reportAppError,
	resolvePickedFolder,
} from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useRouter } from "expo-router"

import { runSubmittingTask, type SidebarUi } from "@/features/sidebar/sidebarUiState"
import { triggerSelectionHaptic } from "@/utils/haptics"

function reportSidebarError(operation: string, userMessage: string, error: unknown): Promise<void> {
	return reportAppError({ operation, source: "mobile-sidebar", cause: error, userMessage })
}

export function useVaultSwitcher({ closeSidebar, dispatchUi, uiState }: SidebarUi) {
	const router = useRouter()

	function finishVaultSwitch() {
		dispatchUi({ presented: false, type: "set-switcher-presented" })
		closeSidebar()
		router.replace("/(notes)" as never)
	}

	async function handleOpenRecentVault(entry: VaultRegistryEntry) {
		await runSubmittingTask(
			dispatchUi,
			async () => {
				await openVaultSession(entry.path, getRegistryOpenOptions(entry))
				finishVaultSwitch()
			},
			(error) =>
				reportSidebarError("open-recent-vault", `"${entry.name}" could not be opened.`, error),
		)
	}

	async function handleBrowseVault() {
		await runSubmittingTask(
			dispatchUi,
			async () => {
				const folderPath = await getPlatform().dialog.pickFolder()
				if (!folderPath) return
				const picked = await resolvePickedFolder(folderPath)
				if (picked.kind === "new") {
					dispatchUi({
						folder: { defaultName: picked.defaultName, path: picked.path },
						type: "set-pending-vault-folder",
					})
					return
				}
				await openVaultSession(picked.entry.path, getRegistryOpenOptions(picked.entry))
				finishVaultSwitch()
			},
			(error) => reportSidebarError("open-vault-folder", "The vault could not be opened.", error),
		)
	}

	function openSwitcher() {
		triggerSelectionHaptic()
		dispatchUi({ presented: true, type: "set-switcher-presented" })
	}

	function dismissSwitcher() {
		if (!uiState.submitting) {
			dispatchUi({ presented: false, type: "set-switcher-presented" })
		}
	}

	function dismissPendingVaultFolder() {
		dispatchUi({ folder: null, type: "set-pending-vault-folder" })
	}

	function handleVaultCreated() {
		dismissPendingVaultFolder()
		dispatchUi({ presented: false, type: "set-switcher-presented" })
		closeSidebar()
	}

	return {
		dismissPendingVaultFolder,
		dismissSwitcher,
		handleBrowseVault,
		handleOpenRecentVault,
		handleVaultCreated,
		openSwitcher,
	}
}
