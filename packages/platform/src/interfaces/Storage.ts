export interface Storage {
	getAppDataDir(): Promise<string>
}
