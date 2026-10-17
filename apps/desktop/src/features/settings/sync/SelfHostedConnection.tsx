import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	normalizeServerUrl,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, Input, Spinner, Switch } from "@cortex/ui"
import { ServerIcon } from "lucide-react"
import { type ChangeEvent, type KeyboardEvent, useEffect, useState } from "react"
import { useConfirmAction } from "../ConfirmActionDialog"
import { SettingsField, SettingsGroup, SettingsSection } from "../SettingsPrimitives"

type ConnectionCheck =
	| { status: "idle" }
	| { status: "checking" }
	| { status: "ok"; version: string }
	| { status: "error"; message: string }

interface ServerUrlFieldProps {
	vaultPath: string | undefined
	savedServerUrl: string | null
}

function validateServerUrl(value: string): string | null {
	try {
		const url = new URL(value)
		if (url.protocol !== "http:" && url.protocol !== "https:")
			return "Use an http:// or https:// URL."
		return null
	} catch {
		return "Enter a full URL, like https://sync.example.com."
	}
}

async function checkServer(url: string): Promise<ConnectionCheck> {
	try {
		const capabilities = await getPlatform().account.getCapabilities(url)
		return { status: "ok", version: capabilities.version }
	} catch (error) {
		return { status: "error", message: error instanceof Error ? error.message : String(error) }
	}
}

function describeCheck(check: ConnectionCheck, validationError: string | null): string {
	if (validationError) return validationError
	switch (check.status) {
		case "checking":
			return "Checking the server…"
		case "ok":
			return `Connected · server ${check.version}`
		case "error":
			return `Can't reach the server: ${check.message}`
		default:
			return "Remote vaults and sign-in use this URL."
	}
}

function ServerUrlField({ vaultPath, savedServerUrl }: ServerUrlFieldProps) {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const saveServerUrl = useRemoteVaultStore((state) => state.saveServerUrl)
	const unlinkVault = useRemoteVaultStore((state) => state.unlinkVault)
	const initialValue = savedServerUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL
	const [inputValue, setInputValue] = useState(initialValue)
	const [saving, setSaving] = useState(false)
	const [check, setCheck] = useState<ConnectionCheck>({ status: "idle" })
	const { confirm, dialog } = useConfirmAction()
	const normalized = normalizeServerUrl(inputValue)
	const validationError = normalized ? validateServerUrl(normalized) : null
	const unchanged = normalized === (savedServerUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL)

	const testConnection = async (url: string) => {
		setCheck({ status: "checking" })
		setCheck(await checkServer(url))
	}

	useEffect(() => {
		if (!savedServerUrl) return
		let cancelled = false
		setCheck({ status: "checking" })
		void checkServer(savedServerUrl).then((result) => {
			if (!cancelled) setCheck(result)
		})
		return () => {
			cancelled = true
		}
	}, [savedServerUrl])

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
		if (!vaultPath || !normalized || validationError || unchanged) return
		if (!linkedVaultId) {
			void save(vaultPath, normalized, false)
			return
		}
		confirm({
			title: "Change sync server?",
			description: "Changing the sync server unlinks this vault from its current remote vault.",
			confirmLabel: "Change server",
			destructive: true,
			onConfirm: () => save(vaultPath, normalized, true),
		})
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") handleSave()
	}

	return (
		<SettingsField
			fieldId="sync-self-host.server-url"
			htmlFor="server-url"
			description={
				<span data-check={validationError ? "error" : check.status}>
					{describeCheck(check, validationError)}
				</span>
			}
			className="settings-server-url"
			controlClassName="settings-env-control-column"
		>
			<div className="settings-env-control">
				<Input
					id="server-url"
					size="sm"
					type="url"
					value={inputValue}
					aria-invalid={validationError ? true : undefined}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						setInputValue(event.target.value)
						setCheck({ status: "idle" })
					}}
					onKeyDown={handleKeyDown}
					placeholder={DEFAULT_SELF_HOSTED_SYNC_SERVER_URL}
					disabled={saving}
				/>
				{unchanged ? (
					<Button
						variant="secondary"
						size="xs"
						onClick={() => void testConnection(normalized)}
						disabled={check.status === "checking" || Boolean(validationError)}
						className="shrink-0"
					>
						{check.status === "checking" ? <Spinner className="size-3" /> : "Test"}
					</Button>
				) : (
					<Button
						variant="secondary"
						size="xs"
						onClick={handleSave}
						disabled={saving || Boolean(validationError) || !normalized}
						className="shrink-0"
					>
						{saving ? <Spinner className="size-3" /> : "Save"}
					</Button>
				)}
			</div>
			{dialog}
		</SettingsField>
	)
}

export function SelfHostedConnection() {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const setSelfHosted = useRemoteVaultStore((state) => state.setSelfHosted)
	const unlinkVault = useRemoteVaultStore((state) => state.unlinkVault)
	const { confirm, dialog } = useConfirmAction()

	const handleToggle = (checked: boolean) => {
		if (!vaultPath) return
		if (!linkedVaultId) {
			void setSelfHosted(vaultPath, checked)
			return
		}
		confirm({
			title: checked ? "Use a self-hosted server?" : "Switch back to Cortex Cloud?",
			description:
				"This vault is linked to a remote vault on the current server. Switching servers unlinks it; your local notes stay on this device.",
			confirmLabel: "Switch server",
			destructive: true,
			onConfirm: async () => {
				await unlinkVault(vaultPath)
				await setSelfHosted(vaultPath, checked)
			},
		})
	}

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
						onCheckedChange={handleToggle}
					/>
				</SettingsField>
				{syncConfig.selfHosted && (
					<ServerUrlField
						key={syncConfig.serverUrl ?? ""}
						vaultPath={vaultPath}
						savedServerUrl={syncConfig.serverUrl}
					/>
				)}
			</SettingsGroup>
			{dialog}
		</SettingsSection>
	)
}
