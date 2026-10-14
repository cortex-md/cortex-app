import { linkVaultFolder } from "../runtime/addVault"
import { useAccountStore } from "../stores/accountStore"
import { useSyncStore } from "../stores/syncStore"
import type { EncryptionStep, VaultKeyDraft } from "./vaultKeyDraft"

export interface VaultKeyFlowOptions {
	vaultPath: string | null
	unlockMode?: boolean
	initialRemoteVaultId?: string | null
	draft: VaultKeyDraft
	updateDraft: (nextDraft: Partial<VaultKeyDraft>) => void
	onLinked: (remoteVaultId: string) => void | Promise<void>
	onWaiting?: (remoteVaultId: string) => void
}

export function createVaultKeyFlow(getOptions: () => VaultKeyFlowOptions) {
	const options = () => getOptions()
	const { unlockMode, initialRemoteVaultId = null } = options()
	const unlockModeAt = () => options().unlockMode
	const updateDraft = (nextDraft: Partial<VaultKeyDraft>) => options().updateDraft(nextDraft)
	const onLinked = (remoteVaultId: string) => options().onLinked(remoteVaultId)
	const onWaiting = (remoteVaultId: string) => options().onWaiting?.(remoteVaultId)
	const checkVaultEncryption = (remoteVaultId: string) =>
		useSyncStore.getState().checkVaultEncryption(remoteVaultId)
	const createVaultKey = (remoteVaultId: string) =>
		useSyncStore.getState().createVaultKey(remoteVaultId)
	const requestVaultKey = (remoteVaultId: string) =>
		useSyncStore.getState().requestVaultKey(remoteVaultId)
	const unlockVaultKey = (remoteVaultId: string, password: string) =>
		useSyncStore.getState().unlockVaultKey(remoteVaultId, password)
	const loadKeyStatus = () => useAccountStore.getState().loadKeyStatus()
	const setupKeys = (password: string) => useAccountStore.getState().setupKeys(password)
	const pendingVaultIdRef: { current: string | null } = {
		current: unlockMode ? initialRemoteVaultId : null,
	}
	const pathRef: { current: string | null } = { current: null }
	const targetPath = () => pathRef.current ?? options().vaultPath

	const reset = () => {
		pendingVaultIdRef.current = null
		updateDraft({ encryptionStep: "none", password: "", encryptionError: null })
	}

	const linkFolder = async (remoteVaultId: string) => {
		const path = targetPath()
		if (!unlockModeAt() && path) await linkVaultFolder(path, remoteVaultId)
	}

	const finishLink = async (remoteVaultId: string) => {
		if (!unlockModeAt()) await linkFolder(remoteVaultId)
		else if (useSyncStore.getState().vekRequired) await useSyncStore.getState().restartSync()
		updateDraft({ encryptionStep: "none" })
		await onLinked(remoteVaultId)
	}

	const resolveVaultKey = async (remoteVaultId: string) => {
		const status = await checkVaultEncryption(remoteVaultId)
		if (status.hasLocalKey) return finishLink(remoteVaultId)
		if (!status.hasKey) {
			await createVaultKey(remoteVaultId)
			return finishLink(remoteVaultId)
		}
		const result = await requestVaultKey(remoteVaultId)
		if (result === "granted") return finishLink(remoteVaultId)
		await linkFolder(remoteVaultId)
		updateDraft({ encryptionStep: "waiting", hasPasswordKey: status.hasPasswordKey })
		onWaiting?.(remoteVaultId)
	}

	const runStep = async (task: () => Promise<void>, failureStep?: EncryptionStep) => {
		updateDraft({ encryptionLoading: true, encryptionError: null })
		try {
			await task()
		} catch (e) {
			updateDraft({
				encryptionError: e instanceof Error ? e.message : String(e),
				...(failureStep ? { encryptionStep: failureStep } : {}),
			})
		} finally {
			updateDraft({ encryptionLoading: false })
		}
	}

	const link = (remoteVaultId: string, nextVaultPath?: string) => {
		if (nextVaultPath) pathRef.current = nextVaultPath
		if (!targetPath() && !unlockModeAt()) return Promise.resolve()
		pendingVaultIdRef.current = remoteVaultId
		return runStep(
			async () => {
				updateDraft({ encryptionStep: "checking" })
				const keyStatus = await loadKeyStatus()
				if (keyStatus && (keyStatus.kdfVersion === 0 || !keyStatus.hasLocalIdentity)) {
					updateDraft({ encryptionStep: "setup-keys" })
					return
				}
				await resolveVaultKey(remoteVaultId)
			},
			unlockModeAt() ? "waiting" : "none",
		)
	}

	const startUnlockCheck = () => {
		const { unlockMode: unlock, initialRemoteVaultId: remoteVaultId } = options()
		if (unlock && remoteVaultId) void link(remoteVaultId)
	}

	const checkAccess = async () => {
		const pendingVaultId = pendingVaultIdRef.current
		if (!pendingVaultId) return
		try {
			const result = await requestVaultKey(pendingVaultId)
			if (result === "granted") await finishLink(pendingVaultId)
		} catch (e) {
			updateDraft({ encryptionError: e instanceof Error ? e.message : String(e) })
		}
	}

	const submitKeySetup = () => {
		const pendingVaultId = pendingVaultIdRef.current
		const { password } = options().draft
		if (!pendingVaultId || password.length < 8) return Promise.resolve()
		return runStep(async () => {
			const result = await setupKeys(password)
			updateDraft({ password: "" })
			if (result.recoveryKey) {
				updateDraft({ encryptionStep: "recovery-key", recoveryKey: result.recoveryKey })
				return
			}
			await resolveVaultKey(pendingVaultId)
		})
	}

	const confirmRecoveryKeySaved = () => {
		const pendingVaultId = pendingVaultIdRef.current
		updateDraft({ recoveryKey: null, encryptionStep: "checking" })
		if (!pendingVaultId) return Promise.resolve()
		return runStep(() => resolveVaultKey(pendingVaultId), "waiting")
	}

	const submitVaultPassword = async () => {
		const pendingVaultId = pendingVaultIdRef.current
		const { password } = options().draft
		if (!pendingVaultId || !password) return
		updateDraft({ encryptionLoading: true, encryptionError: null })
		try {
			await unlockVaultKey(pendingVaultId, password)
			await finishLink(pendingVaultId)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			updateDraft({ encryptionError: msg.includes("Wrong password") ? "Wrong password" : msg })
		} finally {
			updateDraft({ encryptionLoading: false })
		}
	}

	return {
		startUnlockCheck,
		reset,
		link,
		checkAccess,
		submitKeySetup,
		confirmRecoveryKeySaved,
		submitVaultPassword,
	}
}

export type VaultKeyFlow = ReturnType<typeof createVaultKeyFlow>
