import { parseInviteDeepLink, parseSharedNoteDeepLink, parseTemplateDeepLink } from "@cortex/core"

function query(params: Record<string, string | null>): string {
	const search = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
	return search.toString()
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
	const sharedNote = parseSharedNoteDeepLink(path)
	if (sharedNote)
		return `/shared-note?${query({ shareId: sharedNote.shareId, key: sharedNote.key })}`
	const invite = parseInviteDeepLink(path)
	if (invite) return `/invite?${query({ token: invite.token, linkKey: invite.linkKey })}`
	const templateSlug = parseTemplateDeepLink(path)
	if (templateSlug) return `/public-template?${query({ slug: templateSlug })}`
	return path
}
