type RefreshVaultFiles = () => Promise<void>

let currentVaultPath: string | null = null
let refreshVaultFiles: RefreshVaultFiles | null = null

export function setVaultRuntimeState(
	vaultPath: string | null,
	refreshFiles: RefreshVaultFiles,
): void {
	currentVaultPath = vaultPath
	refreshVaultFiles = refreshFiles
}

export function getCurrentVaultPath(): string | null {
	return currentVaultPath
}

export async function refreshCurrentVaultFiles(): Promise<void> {
	await refreshVaultFiles?.()
}
