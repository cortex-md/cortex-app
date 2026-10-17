import { getRegistryOpenOptions, openVaultSession } from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"
import { useEffect, useState } from "react"

import {
	getMobileVaultAccess,
	type MobileVaultAccess,
	reauthorizeMobileVault,
} from "@/platform/vaultAccess"

export type { MobileVaultAccess }

export async function openRegisteredVault(entry: VaultRegistryEntry): Promise<boolean> {
	if ((await getMobileVaultAccess(entry.path)) === "needsAccess") {
		if (!(await reauthorizeMobileVault(entry.path))) return false
	}
	await openVaultSession(entry.path, getRegistryOpenOptions(entry))
	return true
}

async function loadAccess(
	entries: readonly VaultRegistryEntry[],
): Promise<Map<string, MobileVaultAccess>> {
	const states = await Promise.all(
		entries.map(async (entry) => {
			const access = await getMobileVaultAccess(entry.path).catch(
				(): MobileVaultAccess => "missing",
			)
			return [entry.uuid, access] as const
		}),
	)
	return new Map(states)
}

export function accessLabel(access: MobileVaultAccess | undefined): string | undefined {
	if (access === "needsAccess") return "Needs access"
	if (access === "missing") return "Not found"
	return undefined
}

export function useVaultAccess(
	entries: readonly VaultRegistryEntry[],
	generation = 0,
): ReadonlyMap<string, MobileVaultAccess> {
	const [loaded, setLoaded] = useState<ReadonlyMap<string, MobileVaultAccess>>(() => new Map())

	useEffect(() => {
		let cancelled = false
		void loadAccess(entries).then((access) => {
			if (!cancelled) setLoaded(access)
		})
		return () => {
			cancelled = true
		}
	}, [entries, generation])

	return loaded
}
