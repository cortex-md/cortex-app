import { getFonts } from "font-list"
import type { MainApi } from "../contract"

type SystemFonts = Awaited<ReturnType<MainApi["font"]["listSystemFonts"]>>

let systemFonts: Promise<SystemFonts> | null = null

async function loadSystemFonts(): Promise<SystemFonts> {
	const families = await getFonts({ disableQuoting: true })
	return [...new Set(families.map((family) => family.trim()).filter(Boolean))]
		.sort((a, b) => a.localeCompare(b))
		.map((family) => ({ family, postscriptName: null }))
}

export const fontApi = {
	listSystemFonts: () => {
		systemFonts ??= loadSystemFonts().catch((error: unknown) => {
			systemFonts = null
			throw error
		})
		return systemFonts
	},
} satisfies MainApi["font"]
