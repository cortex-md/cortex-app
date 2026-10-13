import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	SELF_HOSTED_ENVIRONMENT_GROUPS,
	type SelfHostedEnvironmentField,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { useEffect, useState } from "react"
import { Platform } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { FormTextField } from "@/features/sync/FormControls"
import {
	copyEnvironmentFile,
	exportEnvironmentFile,
	loadSelfHostedSecrets,
	saveSelfHostedSecret,
} from "@/features/sync/syncAdapter"

const SECRET_STORE = Platform.OS === "ios" ? "iOS keychain" : "Android Keystore"

export function SelfHostedScreen() {
	const vault = useVaultStore((state) => state.vault)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSelfHosted = useRemoteVaultStore((state) => state.setSelfHosted)
	const saveServerUrl = useRemoteVaultStore((state) => state.saveServerUrl)
	const updateSelfHostedEnvironment = useRemoteVaultStore(
		(state) => state.updateSelfHostedEnvironment,
	)
	const [initialUrl] = useState(() => syncConfig.serverUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL)
	const [url, setUrl] = useState(initialUrl)
	const [saved, setSaved] = useState(true)
	const [secrets, setSecrets] = useState<Record<string, string> | null>(null)
	const vaultId = vault?.uuid ?? null
	const vaultPath = vault?.path ?? null

	useEffect(() => {
		if (!vaultId) return
		let cancelled = false
		void loadSelfHostedSecrets(vaultId).then((loaded) => {
			if (!cancelled) setSecrets(loaded)
		})
		return () => {
			cancelled = true
		}
	}, [vaultId])

	const values = syncConfig.selfHostedEnvironment
	const loadedSecrets = secrets ?? {}

	const commitField = (field: SelfHostedEnvironmentField, value: string) => {
		if (field.secret) {
			if (!vaultId || loadedSecrets[field.key] === value) return
			setSecrets((current) => ({ ...current, [field.key]: value }))
			void saveSelfHostedSecret(vaultId, field.key, value)
			return
		}
		if (!vaultPath || (values[field.key] ?? "") === value.trim()) return
		void updateSelfHostedEnvironment(vaultPath, field.key, value.trim() || null)
	}

	const handleSave = () => {
		if (!vaultPath || !url.trim()) return
		void saveServerUrl(vaultPath, url.trim()).then(() => {
			setSaved(true)
			toast("Server URL saved")
		})
	}

	const handleCopy = () => {
		void copyEnvironmentFile(values, loadedSecrets).then(() => toast("Copied .env"))
	}

	const handleExport = () => {
		void exportEnvironmentFile(values, loadedSecrets).catch(() => toast("Export was cancelled"))
	}

	return (
		<NativeForm>
			<FormSection footer="Remote vaults and sign-in use this server." title="Server">
				<FormToggle
					onValueChange={(value) => {
						if (vaultPath) void setSelfHosted(vaultPath, value)
					}}
					title="Use a self-hosted server"
					value={syncConfig.selfHosted}
				/>
				<FormTextField
					initialValue={initialUrl}
					keyboard="url"
					monospace
					onChangeText={(value) => {
						setUrl(value)
						setSaved(false)
					}}
					onSubmit={handleSave}
					placeholder="https://sync.example.com"
				/>
				<FormRow disabled={saved || !url.trim()} onPress={handleSave} tint title="Save URL" />
			</FormSection>
			{SELF_HOSTED_ENVIRONMENT_GROUPS.map((group) => (
				<FormSection footer={group.description} key={group.id} title={group.label}>
					{group.sections.flatMap((section) =>
						section.fields.map((field) => (
							<FormTextField
								initialValue={
									field.secret ? (loadedSecrets[field.key] ?? "") : (values[field.key] ?? "")
								}
								key={`${field.key}-${secrets ? "ready" : "loading"}`}
								keyboard="url"
								label={field.label}
								monospace
								onCommit={(value) => commitField(field, value)}
								placeholder={field.defaultValue || field.key}
								secure={field.secret}
							/>
						)),
					)}
				</FormSection>
			))}
			<FormSection footer={`Secrets are stored in the ${SECRET_STORE}.`} title="Environment file">
				<FormRow
					icon={{ sf: "doc.on.doc", md: "content_copy" }}
					onPress={handleCopy}
					tint
					title="Copy .env"
				/>
				<FormRow
					icon={{ sf: "square.and.arrow.up", md: "ios_share" }}
					onPress={handleExport}
					tint
					title="Export .env"
				/>
			</FormSection>
		</NativeForm>
	)
}
