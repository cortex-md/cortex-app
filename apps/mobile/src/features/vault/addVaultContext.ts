import { createContext, useContext } from "react"

import type { AddVaultPatch } from "@/features/vault/addVaultActions"
import type { AddVaultState } from "@/features/vault/addVaultState"

export type AddVaultRoute = "name" | "sync" | "remote" | "password" | "done"

export interface AddVaultContextValue {
	patch: AddVaultPatch
	state: AddVaultState
}

export const AddVaultContext = createContext<AddVaultContextValue | null>(null)

export function useAddVault(): AddVaultContextValue {
	const value = useContext(AddVaultContext)
	if (!value) throw new Error("useAddVault must be used inside the add-vault layout")
	return value
}
