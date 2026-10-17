export interface NativeWindow {
	closeCurrent(): Promise<void>
	focusMain(): Promise<void>
	restartApp(): Promise<void>
	setColorScheme(scheme: "light" | "dark" | "system"): Promise<void>
	openVaultWindow(vaultPath: string): Promise<void>
	openNewWindow(): Promise<void>
	claimVault(vaultPath: string): Promise<"claimed" | "focused-owner">
	releaseVault(): Promise<void>
	markReady(): Promise<void>
	claimOnce(key: string): Promise<boolean>
}
