import type { TemplateDefinition } from "@cortex/core"

interface TemplateEditorDraft {
	id?: string
	name: string
	description: string
	body: string
	targetFolderPattern: string
	fileNamePattern: string
	customPlaceholders: Record<string, string>
}

function createEmptyDraft(): TemplateEditorDraft {
	return {
		name: "Untitled template",
		description: "",
		body: "# {{ note.title }}\n\n",
		targetFolderPattern: "",
		fileNamePattern: "{{ note.title | slug }}",
		customPlaceholders: {},
	}
}

function createTemplateDraft(
	template: TemplateDefinition | null,
	body: string,
): TemplateEditorDraft {
	if (!template) return createEmptyDraft()
	return {
		id: template.id,
		name: template.name,
		description: template.description ?? "",
		body,
		targetFolderPattern: template.targetFolderPattern,
		fileNamePattern: template.fileNamePattern,
		customPlaceholders: template.customPlaceholders ?? {},
	}
}

export { createEmptyDraft, createTemplateDraft }
export type { TemplateEditorDraft }
