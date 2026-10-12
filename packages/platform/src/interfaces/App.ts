export type DeepLinkOpenListener = (urls: string[]) => void

export type NativeEventListener<T = unknown> = (payload: T) => void

export interface App {
	getCurrentAppVersion: () => Promise<string>
	openExternalUrl: (url: string) => Promise<void>
	resolveFileAssetUrl: (path: string) => string
	onDeepLinkOpen: (listener: DeepLinkOpenListener) => () => void
	onNativeEvent: <T = unknown>(name: string, listener: NativeEventListener<T>) => () => void
}
