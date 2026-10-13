import {
	getRegistryOpenOptions,
	openVaultSession,
	reportAppError,
	resolvePickedFolder,
} from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useState } from "react"

import { goToFilesRoot, openOnboarding } from "@/features/navigation/routes"
import { triggerSelectionHaptic } from "@/utils/haptics"

interface SwitcherState {
	openingUuid: string | null
	submitting: boolean
}

const idleState: SwitcherState = { openingUuid: null, submitting: false }

function reportVaultError(operation: string, userMessage: string, error: unknown): Promise<void> {
	return reportAppError({ operation, source: "mobile-vault", cause: error, userMessage })
}

async function openVaultEntry(
	entry: VaultRegistryEntry,
	setState: (state: SwitcherState) => void,
): Promise<boolean> {
	triggerSelectionHaptic()
	setState({ openingUuid: entry.uuid, submitting: true })
	try {
		await openVaultSession(entry.path, getRegistryOpenOptions(entry))
		goToFilesRoot()
		return true
	} catch (error) {
		await reportVaultError("open-recent-vault", `"${entry.name}" could not be opened.`, error)
		return false
	} finally {
		setState(idleState)
	}
}

async function browseVaultFolder(setState: (state: SwitcherState) => void): Promise<boolean> {
	setState({ openingUuid: null, submitting: true })
	try {
		const folderPath = await getPlatform().dialog.pickFolder()
		if (!folderPath) return false
		const picked = await resolvePickedFolder(folderPath)
		if (picked.kind === "new") {
			openOnboarding({ name: picked.defaultName, path: picked.path })
			return true
		}
		return await openVaultEntry(picked.entry, setState)
	} catch (error) {
		await reportVaultError("open-vault-folder", "The vault could not be opened.", error)
		return false
	} finally {
		setState(idleState)
	}
}

export function useVaultSwitcher() {
	const [state, setState] = useState<SwitcherState>(idleState)

	return {
		browseFolder: () => browseVaultFolder(setState),
		openVault: (entry: VaultRegistryEntry) => openVaultEntry(entry, setState),
		openingUuid: state.openingUuid,
		submitting: state.submitting,
	}
}
