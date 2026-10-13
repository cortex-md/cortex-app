import type { AddVaultPath } from "@cortex/core"
import { Stack, useGlobalSearchParams } from "expo-router"
import { useMemo, useState } from "react"

import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"
import { AddVaultContext } from "@/features/vault/addVaultContext"
import { type AddVaultState, createAddVaultState } from "@/features/vault/addVaultState"

const START_VALUES = new Set<string>(["choose", "create", "open", "download"])

function first(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

export function AddVaultLayout() {
	const params = useGlobalSearchParams<{ start?: string; remoteVaultId?: string }>()
	const screenOptions = useStackScreenOptions()
	const [state, setState] = useState<AddVaultState>(() => {
		const start = first(params.start) ?? "choose"
		return createAddVaultState(
			START_VALUES.has(start) ? (start as AddVaultPath | "choose") : "choose",
			first(params.remoteVaultId) ?? null,
		)
	})
	const value = useMemo(
		() => ({
			patch: (next: Partial<AddVaultState>) => setState((current) => ({ ...current, ...next })),
			state,
		}),
		[state],
	)

	return (
		<AddVaultContext value={value}>
			<Stack screenOptions={screenOptions}>
				<Stack.Screen name="index" options={{ title: "Add vault" }} />
				<Stack.Screen name="name" options={{ title: "New vault" }} />
				<Stack.Screen name="sync" options={{ title: "Sync" }} />
				<Stack.Screen name="remote" options={{ title: "Remote vault" }} />
				<Stack.Screen name="password" options={{ title: "Password" }} />
				<Stack.Screen
					name="done"
					options={{ gestureEnabled: false, headerBackVisible: false, title: "Ready" }}
				/>
			</Stack>
		</AddVaultContext>
	)
}
