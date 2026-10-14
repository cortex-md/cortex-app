import {
	createVaultKeyDraft,
	createVaultKeyFlow,
	useRemoteVaultStore,
	useVaultStore,
	VAULT_KEY_POLL_MS,
	type VaultKeyDraft,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { router, Stack } from "expo-router"
import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { openSettings } from "@/features/navigation/routes"
import { FormCheck, FormTextField } from "@/features/sync/FormControls"
import { getRemoteVaultLinkOptions } from "@/features/sync/syncAdapter"
import { NEW_REMOTE_VAULT_OPTION_ID } from "@/features/sync/syncTypes"

const MIN_ACCOUNT_PASSWORD_LENGTH = 8

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function closeSheet() {
	if (router.canGoBack()) router.back()
}

function createLinkSession() {
	let draft = createVaultKeyDraft()
	let targetName = ""
	const listeners = new Set<() => void>()
	const updateDraft = (next: Partial<VaultKeyDraft>) => {
		draft = { ...draft, ...next }
		for (const listener of listeners) listener()
	}
	const flow = createVaultKeyFlow(() => ({
		vaultPath: useVaultStore.getState().vault?.path ?? null,
		draft,
		updateDraft,
		onLinked: () => {
			toast(`Linked to ${targetName}. The first sync is running.`)
			closeSheet()
		},
	}))
	return {
		flow,
		updateDraft,
		getDraft: () => draft,
		setTargetName: (name: string) => {
			targetName = name
		},
		subscribe: (listener: () => void) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
	}
}

function WaitingPoller({ onCheck }: { onCheck: () => Promise<void> }) {
	const check = useEffectEvent(() => {
		void onCheck()
	})
	useEffect(() => {
		const interval = setInterval(check, VAULT_KEY_POLL_MS)
		return () => clearInterval(interval)
	}, [])
	return null
}

export function LinkVaultChooseScreen() {
	const vault = useVaultStore((state) => state.vault)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const loading = useRemoteVaultStore((state) => state.loading)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const options = getRemoteVaultLinkOptions(remoteVaults, linkedVaultId)
	const [pickId, setPickId] = useState<string | null>(null)
	const [newName, setNewName] = useState(vault?.name ?? "")
	const [targetName, setTargetName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [keyView, setKeyView] = useState(false)
	const [session] = useState(createLinkSession)
	const draft = useSyncExternalStore(session.subscribe, session.getDraft)
	const { flow, updateDraft } = session

	useEffect(() => {
		void useRemoteVaultStore.getState().fetchRemoteVaults()
	}, [])

	const selectedId =
		pickId ?? options.find((option) => !option.taken && !option.isNew)?.id ?? options[0]?.id
	const picked = options.find((option) => option.id === selectedId)

	const startLink = async () => {
		if (!picked || !vault || busy) return
		setBusy(true)
		setError(null)
		try {
			let remoteVaultId = picked.id
			const name = picked.isNew ? newName.trim() || vault.name : picked.name
			if (picked.isNew) {
				const created = await useRemoteVaultStore.getState().createRemoteVault(name, null)
				remoteVaultId = created.id
			}
			setTargetName(name)
			session.setTargetName(name)
			setKeyView(true)
			await flow.link(remoteVaultId)
		} catch (linkError) {
			setError(errorText(linkError))
			setKeyView(false)
		} finally {
			setBusy(false)
		}
	}

	if (keyView) {
		return (
			<VaultKeySteps
				close={closeSheet}
				draft={draft}
				flow={flow}
				onBack={() => {
					flow.reset()
					setKeyView(false)
				}}
				targetName={targetName}
				updateDraft={updateDraft}
			/>
		)
	}

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "Link vault" }} />
			<NativeForm>
				<FormSection footer={error ?? undefined} title="Cortex Cloud">
					{loading && remoteVaults.length === 0 ? <FormRow title="Loading remote vaults…" /> : null}
					{options.map((option) => (
						<FormRow
							disabled={option.taken}
							icon={
								option.isNew
									? { sf: "plus.circle", md: "add_circle" }
									: { sf: "icloud", md: "cloud" }
							}
							key={option.id}
							onPress={() => {
								setPickId(option.id)
								setError(null)
							}}
							subtitle={option.description}
							title={option.name}
							trailing={<FormCheck checked={option.id === selectedId} />}
						/>
					))}
				</FormSection>
				{picked?.id === NEW_REMOTE_VAULT_OPTION_ID ? (
					<FormSection title="Name">
						<FormTextField initialValue={newName} onChangeText={setNewName} placeholder="Notes" />
					</FormSection>
				) : null}
				<FormSection>
					<FormRow
						disabled={!picked || busy}
						onPress={() => void startLink()}
						tint
						title={picked?.isNew ? "Create and link" : "Link"}
					/>
				</FormSection>
				<FormSection>
					<FormRow
						chevron
						icon={{ sf: "server.rack", md: "dns" }}
						onPress={() => openSettings("sync/self-hosted")}
						title="Use a self-hosted server"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}

function VaultKeySteps({
	close,
	draft,
	flow,
	onBack,
	targetName,
	updateDraft,
}: {
	close: () => void
	draft: VaultKeyDraft
	flow: ReturnType<typeof createVaultKeyFlow>
	onBack: () => void
	targetName: string
	updateDraft: (next: Partial<VaultKeyDraft>) => void
}) {
	const { encryptionError, encryptionLoading, encryptionStep, password, recoveryKey } = draft
	const [checking, setChecking] = useState(false)

	if (encryptionStep === "recovery-key" && recoveryKey) {
		return (
			<>
				<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "Recovery key" }} />
				<NativeForm>
					<FormSection
						footer="Store it somewhere safe. It is the only way back into your notes if you forget your password."
						title="Your recovery key"
					>
						<FormRow title={recoveryKey} />
						<FormRow
							icon={{ sf: "doc.on.doc", md: "content_copy" }}
							onPress={() => {
								void getPlatform().clipboard.writeText(recoveryKey)
								toast("Recovery key copied")
							}}
							tint
							title="Copy"
						/>
					</FormSection>
					<FormSection>
						<FormRow
							disabled={encryptionLoading}
							onPress={() => void flow.confirmRecoveryKeySaved()}
							tint
							title="I saved it"
						/>
					</FormSection>
				</NativeForm>
			</>
		)
	}

	if (encryptionStep === "setup-keys" || encryptionStep === "enter-password") {
		const setup = encryptionStep === "setup-keys"
		const ready = setup ? password.length >= MIN_ACCOUNT_PASSWORD_LENGTH : password.length > 0
		const submit = () => {
			if (!ready || encryptionLoading) return
			void (setup ? flow.submitKeySetup() : flow.submitVaultPassword())
		}
		return (
			<>
				<Stack.Screen
					options={{
						headerLargeTitleEnabled: false,
						title: setup ? `Protect ${targetName}` : `Unlock ${targetName}`,
					}}
				/>
				<NativeForm>
					<FormSection
						footer={
							encryptionError ??
							(setup
								? "Notes are end-to-end encrypted. Enter your account password once on this device and vault keys are shared with you automatically."
								: `${targetName} still uses a vault password. Ask the owner if you don’t have it.`)
						}
						title={setup ? "Account password" : "Encryption password"}
					>
						<FormTextField
							autoFocus
							key={encryptionStep}
							onChangeText={(value) => updateDraft({ password: value, encryptionError: null })}
							onSubmit={submit}
							placeholder="Password"
							secure
						/>
					</FormSection>
					<FormSection>
						<FormRow
							disabled={!ready || encryptionLoading}
							onPress={submit}
							tint
							title={encryptionLoading ? "Working…" : setup ? "Continue" : "Unlock"}
						/>
						<FormRow disabled={encryptionLoading} onPress={onBack} title="Back" />
					</FormSection>
				</NativeForm>
			</>
		)
	}

	if (encryptionStep === "waiting") {
		const checkNow = async () => {
			setChecking(true)
			try {
				await flow.checkAccess()
			} finally {
				setChecking(false)
			}
		}
		return (
			<>
				<WaitingPoller onCheck={flow.checkAccess} />
				<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "Waiting for access" }} />
				<NativeForm>
					<FormSection
						footer={
							encryptionError ??
							`${targetName} is linked. Its key is shared with you as soon as a vault admin’s device is online, and sync starts on its own.`
						}
					>
						<FormRow
							disabled={checking}
							icon={{ sf: "arrow.clockwise", md: "refresh" }}
							onPress={() => void checkNow()}
							tint
							title="Check now"
						/>
						{draft.hasPasswordKey ? (
							<FormRow
								icon={{ sf: "key", md: "key" }}
								onPress={() =>
									updateDraft({ encryptionStep: "enter-password", encryptionError: null })
								}
								title="Use vault password"
							/>
						) : null}
					</FormSection>
					<FormSection>
						<FormRow onPress={close} title="Close" />
					</FormSection>
				</NativeForm>
			</>
		)
	}

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: `Unlock ${targetName}` }} />
			<NativeForm>
				<FormSection footer={encryptionError ?? "Looking for the key to this vault."}>
					<FormRow disabled={encryptionLoading} onPress={onBack} title="Back" />
				</FormSection>
			</NativeForm>
		</>
	)
}
