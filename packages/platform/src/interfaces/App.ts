export type DeepLinkOpenListener = (urls: string[]) => void

export interface App {
	getCurrentAppVersion: () => Promise<string>
	openExternalUrl: (url: string) => Promise<void>
	resolveFileAssetUrl: (path: string) => string
	onDeepLinkOpen: (listener: DeepLinkOpenListener) => Promise<() => void>
}
