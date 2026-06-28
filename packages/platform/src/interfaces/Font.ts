export interface FontInfo {
	family: string
	postscriptName: string | null
}

export interface Font {
	listSystemFonts(): Promise<FontInfo[]>
}
