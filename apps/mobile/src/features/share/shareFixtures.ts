import type { ShareGroup, SharePreviewRow, ShareSubject } from "@/features/share/shareTypes"

export const FIXTURE_SITE = "https://cortex.md"

export const FIXTURE_OWNER = "Ana Moreira"

export function fixtureShareGroups(vaultName: string): ShareGroup[] {
	return [
		{ id: "design", memberCount: 6, name: "Design" },
		{ id: "eng", memberCount: 9, name: "Engineering" },
		{ id: null, memberCount: 15, name: `Everyone in ${vaultName}` },
	]
}

export const fixturePreviewRows: SharePreviewRow[] = [
	{ date: "Oct 14", status: "In progress", title: "Sync beta" },
	{ date: "Oct 21", status: "In progress", title: "Public notes" },
]

export const fixtureShareSubject: ShareSubject = {
	description: "Track work by status, owner and due date. Opens as a table, board and calendar.",
	folderPath: null,
	name: "Projects",
	ownerName: FIXTURE_OWNER,
	previewRows: fixturePreviewRows,
	propertyCount: 5,
	rowTemplateNames: ["Project brief", "Bug report"],
	sampleCount: 3,
	viewNames: ["Table", "Board", "Calendar"],
}

export const FIXTURE_LISTING_NAME = "Projects & roadmap"

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-|-$/gu, "")
}
