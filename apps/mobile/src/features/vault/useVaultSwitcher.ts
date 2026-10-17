import { resolvePickedFolder } from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useState } from "react"

import { goToFilesRoot, openOnboarding } from "@/features/navigation/routes"
import { openRegisteredVault } from "@/features/vault/vaultAccess"
import { showVaultError } from "@/features/vault/vaultErrors"
import { getMobileVaultFolderName } from "@/platform/vaultAccess"
import { triggerSelectionHaptic } from "@/utils/haptics"

interface SwitcherState {
	openingUuid: string | null
	submitting: boolean
}

const idleState: SwitcherState = { openingUuid: null, submitting: false }

async function openVaultEntry(
	entry: VaultRegistryEntry,
	setState: (state: SwitcherState) => void,
): Promise<boolean> {
	triggerSelectionHaptic()
	setState({ openingUuid: entry.uuid, submitting: true })
	try {
		if (!(await openRegisteredVault(entry))) return false
		goToFilesRoot()
		return true
	} catch (error) {
		showVaultError(`Couldn't open “${entry.name}”`, error)
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
			const name = (await getMobileVaultFolderName(picked.path)) ?? ""
			openOnboarding({ name, path: picked.path })
			return true
		}
		return await openVaultEntry(picked.entry, setState)
	} catch (error) {
		showVaultError("Couldn't open the folder", error)
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
