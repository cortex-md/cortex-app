import {
	getErrorMessage,
	noteCache,
	type TemplateDefinition,
	type TemplateVault,
	useEditorStore,
	useTemplateStore,
} from "@cortex/core"
import {
	locateFrontmatter,
	mergeMissingNoteProperties,
	removeNoteProperties,
} from "@cortex/properties"
import { type Href, router } from "expo-router"

import { toast, toastWithUndo } from "@/features/feedback/useToast"
import { getTeamTemplateMeta } from "@/features/templates/templatesAdapter"

export function presentInsertTemplate(filePath: string): void {
	router.push({ params: { filePath }, pathname: "/insert-template" } as Href)
}

function getNoteTitle(filePath: string): string {
	const name = filePath.split(/[\\/]/).pop() ?? filePath
	return name.replace(/\.md$/i, "")
}

function getBodyStart(raw: string): number {
	return locateFrontmatter(raw)?.to ?? 0
}

async function rewriteNote(filePath: string, transform: (raw: string) => string): Promise<void> {
	const entry = noteCache.getEntry(filePath) ?? (await noteCache.readEntry(filePath))
	const next = transform(entry.content)
	if (next !== entry.content) noteCache.writeExternal(filePath, next)
}

function buildInsertion(raw: string, bodyOffset: number, body: string): string {
	const at = getBodyStart(raw) + bodyOffset
	const before = at > getBodyStart(raw) ? raw.slice(at - 1, at) : "\n"
	return `${before === "\n" ? "" : "\n"}${body.replace(/^\n+/, "")}`
}

async function removeInsertion(
	filePath: string,
	bodyOffset: number,
	inserted: string,
	added: string[],
) {
	await rewriteNote(filePath, (raw) => {
		const at = getBodyStart(raw) + bodyOffset
		if (raw.slice(at, at + inserted.length) === inserted) {
			return raw.slice(0, at) + raw.slice(at + inserted.length)
		}
		const index = raw.lastIndexOf(inserted)
		return index < 0 ? raw : raw.slice(0, index) + raw.slice(index + inserted.length)
	})
	await removeNoteProperties(filePath, added)
}

export async function insertTemplateIntoNote(
	vault: TemplateVault,
	template: TemplateDefinition,
	filePath: string,
): Promise<boolean> {
	try {
		const result = await useTemplateStore
			.getState()
			.renderTemplateForInsert(vault, template.id, getNoteTitle(filePath))
		const cursorOffset = useEditorStore.getState().cursor?.offset
		let bodyOffset = 0
		let inserted = ""
		await rewriteNote(filePath, (raw) => {
			const bodyLength = raw.length - getBodyStart(raw)
			bodyOffset = Math.min(Math.max(cursorOffset ?? bodyLength, 0), bodyLength)
			inserted = buildInsertion(raw, bodyOffset, result.body)
			const at = getBodyStart(raw) + bodyOffset
			return raw.slice(0, at) + inserted + raw.slice(at)
		})
		const added = await mergeMissingNoteProperties(filePath, result.properties)
		const team = getTeamTemplateMeta(template)
		toastWithUndo(`Inserted “${template.name}”${team ? ` from ${team.groupName}` : ""}`, () => {
			void removeInsertion(filePath, bodyOffset, inserted, added).catch((error: unknown) =>
				toast(getErrorMessage(error)),
			)
		})
		return true
	} catch (error) {
		toast(getErrorMessage(error))
		return false
	}
}
