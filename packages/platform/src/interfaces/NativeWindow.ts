export interface NativeWindow {
	closeCurrent(): Promise<void>
	focusMain(): Promise<void>
	restartApp(): Promise<void>
}
