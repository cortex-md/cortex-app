export type EncryptionStep =
	| "none"
	| "checking"
	| "enter-password"
	| "waiting"
	| "setup-keys"
	| "recovery-key"

export interface VaultKeyDraft {
	encryptionStep: EncryptionStep
	password: string
	hasPasswordKey: boolean
	recoveryKey: string | null
	encryptionError: string | null
	encryptionLoading: boolean
}

export function createVaultKeyDraft(encryptionStep: EncryptionStep = "none"): VaultKeyDraft {
	return {
		encryptionStep,
		password: "",
		hasPasswordKey: false,
		recoveryKey: null,
		encryptionError: null,
		encryptionLoading: false,
	}
}

export const VAULT_KEY_POLL_MS = 10_000
