export type NativePlatform = "macos" | "windows" | "linux" | "ios" | "android" | "web"
export type NativeColorScheme = "light" | "dark"
export type NativeScrollbarStyle = "overlay" | "thin" | "classic"

export interface NativeAppearanceSnapshot {
	platform: NativePlatform
	colorScheme: NativeColorScheme
	reducedMotion: boolean
	highContrast: boolean
	accentColor: string | null
	scrollbarStyle: NativeScrollbarStyle
}

export interface Appearance {
	getSnapshot(): Promise<NativeAppearanceSnapshot>
	subscribe(listener: (snapshot: NativeAppearanceSnapshot) => void): () => void
}
