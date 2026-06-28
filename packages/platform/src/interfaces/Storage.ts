export interface Storage {
	getAppDataDir(): Promise<string>
	getVaultConfigDir(vaultPath: string): Promise<string>
}
