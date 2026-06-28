import {
	createSyncEnvironmentSecretKey,
	SELF_HOSTED_ENVIRONMENT_FIELDS,
	type SelfHostedEnvironmentField,
	serializeSelfHostedEnvironment,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useEffect, useMemo, useState } from "react"

export function useSelfHostedEnvironment() {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const vaultId = useVaultStore((state) => state.vault?.uuid)
	const environment = useRemoteVaultStore((state) => state.syncConfig.selfHostedEnvironment)
	const updateEnvironment = useRemoteVaultStore((state) => state.updateSelfHostedEnvironment)
	const [secrets, setSecrets] = useState<Record<string, string>>({})

	useEffect(() => {
		let cancelled = false
		async function loadSecrets() {
			if (!vaultId) {
				setSecrets({})
				return
			}
			const platform = getPlatform()
			const entries = await Promise.all(
				SELF_HOSTED_ENVIRONMENT_FIELDS.flatMap((field) =>
					field.secret
						? [
								(async () =>
									[
										field.key,
										await platform.keychain.get(createSyncEnvironmentSecretKey(vaultId, field.key)),
									] as const)(),
							]
						: [],
				),
			)
			if (cancelled) return
			setSecrets(
				Object.fromEntries(
					entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
				),
			)
		}
		void loadSecrets()
		return () => {
			cancelled = true
		}
	}, [vaultId])

	const updateField = async (field: SelfHostedEnvironmentField, value: string) => {
		if (!vaultPath || !vaultId) return
		if (field.secret) {
			const platform = getPlatform()
			const key = createSyncEnvironmentSecretKey(vaultId, field.key)
			if (value) {
				await platform.keychain.set(key, value)
			} else {
				await platform.keychain.delete(key)
			}
			setSecrets((previous) => {
				const next = { ...previous }
				if (value) next[field.key] = value
				else delete next[field.key]
				return next
			})
			return
		}
		await updateEnvironment(vaultPath, field.key, value)
	}

	const environmentFile = useMemo(
		() => serializeSelfHostedEnvironment(environment, secrets),
		[environment, secrets],
	)

	return { environment, environmentFile, secrets, updateField }
}
