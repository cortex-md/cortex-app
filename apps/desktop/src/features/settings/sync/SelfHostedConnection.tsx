import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { Button, Input, Spinner, Switch } from "@cortex/ui"
import { ServerIcon } from "lucide-react"
import { type ChangeEvent, type KeyboardEvent, useState } from "react"
import { useConfirmAction } from "../ConfirmActionDialog"
import { SettingsField, SettingsGroup, SettingsSection } from "../SettingsPrimitives"

interface ServerUrlFieldProps {
	vaultPath: string | undefined
	savedServerUrl: string | null
}

function ServerUrlField({ vaultPath, savedServerUrl }: ServerUrlFieldProps) {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const saveServerUrl = useRemoteVaultStore((state) => state.saveServerUrl)
	const unlinkVault = useRemoteVaultStore((state) => state.unlinkVault)
	const initialValue = savedServerUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL
	const [inputValue, setInputValue] = useState(initialValue)
	const [saving, setSaving] = useState(false)
	const { confirm, dialog } = useConfirmAction()

	const save = async (path: string, url: string, unlink: boolean) => {
		if (unlink) await unlinkVault(path)
		setSaving(true)
		try {
			await saveServerUrl(path, url)
		} finally {
			setSaving(false)
		}
	}

	const handleSave = () => {
		const trimmed = inputValue.trim().replace(/\/+$/, "")
		if (!vaultPath || !trimmed || trimmed === savedServerUrl) return
		if (!linkedVaultId) {
			void save(vaultPath, trimmed, false)
			return
		}
		confirm({
			title: "Change sync server?",
			description: "Changing the sync server unlinks this vault from its current remote vault.",
			confirmLabel: "Change server",
			destructive: true,
			onConfirm: () => save(vaultPath, trimmed, true),
		})
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") handleSave()
	}

	return (
		<div className="settings-env-control">
			<Input
				id="server-url"
				size="sm"
				type="url"
				value={inputValue}
				onChange={(event: ChangeEvent<HTMLInputElement>) => setInputValue(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={DEFAULT_SELF_HOSTED_SYNC_SERVER_URL}
				disabled={saving}
			/>
			<Button
				variant="secondary"
				size="xs"
				onClick={handleSave}
				disabled={saving || inputValue.trim() === savedServerUrl}
				className="shrink-0"
			>
				{saving ? <Spinner className="size-3" /> : "Save"}
			</Button>
			{dialog}
		</div>
	)
}

export function SelfHostedConnection() {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSelfHosted = useRemoteVaultStore((state) => state.setSelfHosted)

	return (
		<SettingsSection title="Connection">
			<SettingsGroup>
				<SettingsField
					fieldId="sync-self-host.enabled"
					icon={<ServerIcon />}
					htmlFor="self-hosted-sync"
				>
					<Switch
						id="self-hosted-sync"
						size="sm"
						checked={syncConfig.selfHosted}
						onCheckedChange={(checked) => vaultPath && void setSelfHosted(vaultPath, checked)}
					/>
				</SettingsField>
				<SettingsField
					fieldId="sync-self-host.server-url"
					htmlFor="server-url"
					controlClassName="settings-env-control-column"
				>
					<ServerUrlField
						key={syncConfig.serverUrl ?? ""}
						vaultPath={vaultPath}
						savedServerUrl={syncConfig.serverUrl}
					/>
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}
