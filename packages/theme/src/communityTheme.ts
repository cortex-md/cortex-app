import { z } from "zod"
import type { CommunityThemeManifest } from "./types"

function isSafeRelativePath(path: string): boolean {
	const normalized = path.replaceAll("\\", "/").trim()
	const segments = normalized.split("/").filter((segment) => segment && segment !== ".")
	return (
		normalized.length > 0 &&
		!normalized.startsWith("/") &&
		!/^[a-zA-Z]:/.test(normalized) &&
		segments.length > 0 &&
		segments.every((segment) => segment !== "..")
	)
}

const communityThemeManifestSchema = z.object({
	id: z.string().min(1),
	name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
	displayName: z.string().min(1),
	author: z.string().min(1),
	authorUrl: z.string().url().optional(),
	version: z.string().min(1),
	minAppVersion: z.string().min(1).optional(),
	colorschemes: z.object({
		dark: z.string().refine(isSafeRelativePath, "Dark theme path must be relative and safe"),
		light: z.string().refine(isSafeRelativePath, "Light theme path must be relative and safe"),
	}),
})

export function parseCommunityThemeManifest(source: string): CommunityThemeManifest {
	let manifest: unknown
	try {
		manifest = JSON.parse(source)
	} catch {
		throw new Error("Theme manifest is not valid JSON")
	}

	const result = communityThemeManifestSchema.safeParse(manifest)
	if (result.success) return result.data

	throw new Error(result.error.issues.map((issue) => issue.message).join("; "))
}
