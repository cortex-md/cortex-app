import { getFonts } from "font-list"

export interface FontInfo {
	family: string
	postscriptName: string | null
}

export async function listSystemFonts(): Promise<FontInfo[]> {
	const families = await getFonts({ disableQuoting: true })
	const unique = [...new Set(families.map((family) => family.trim()).filter(Boolean))].sort(
		(a, b) => a.localeCompare(b),
	)
	return unique.map((family) => ({
		family,
		postscriptName: null,
	}))
}
