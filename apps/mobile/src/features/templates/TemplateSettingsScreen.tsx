import { getErrorMessage, type TemplateVault, useTemplateStore } from "@cortex/core"
import { type Href, router, Stack, useLocalSearchParams } from "expo-router"
import { useState } from "react"

import { FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { FormTextField } from "@/features/importExport/FormFields"
import { HeaderActions } from "@/features/importExport/HeaderActions"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import {
	createTemplateContext,
	renderPattern,
	stripMarkdownExtension,
	useVaultTemplates,
} from "@/features/templates/templatesAdapter"

const SAMPLE_NOTE_TITLE = "Design review"

function routeHref(pathname: string, params: Record<string, string>): Href {
	return { params, pathname } as Href
}

export function openTemplateSettings(templateId: string): void {
	router.push(routeHref("/template-settings", { templateId }))
}

async function saveSettings(
	vault: TemplateVault,
	templateId: string,
	targetFolderPattern: string,
	fileNamePattern: string,
): Promise<boolean> {
	try {
		await useTemplateStore
			.getState()
			.updateTemplate(vault, templateId, { fileNamePattern, targetFolderPattern })
		return true
	} catch (error) {
		toast(getErrorMessage(error))
		return false
	}
}

export function TemplateSettingsScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ templateId?: string | string[] }>()
	const templateId = Array.isArray(params.templateId) ? params.templateId[0] : params.templateId
	const { templates, vault } = useVaultTemplates()
	const template = templates.find((item) => item.id === templateId) ?? null
	const [folder, setFolder] = useState<string | null>(null)
	const [pattern, setPattern] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	if (!template || !vault) return <Stack.Screen options={{ title: "New notes" }} />

	const currentFolder = folder ?? template.targetFolderPattern
	const currentPattern = pattern ?? template.fileNamePattern
	const context = createTemplateContext(vault, template, SAMPLE_NOTE_TITLE)
	const renderedFolder = renderPattern(currentFolder, context) || "Inbox"
	const renderedFile = stripMarkdownExtension(
		renderPattern(currentPattern, context) || SAMPLE_NOTE_TITLE,
	)

	function save() {
		if (saving || !template || !vault) return
		setSaving(true)
		void saveSettings(vault, template.id, currentFolder.trim(), currentPattern.trim()).then(
			(saved) => {
				setSaving(false)
				if (saved && router.canGoBack()) router.back()
			},
		)
	}

	return (
		<>
			<Stack.Screen options={{ title: "New notes" }} />
			<HeaderActions right={{ disabled: saving, label: "Save", onPress: save, primary: true }} />
			<NativeForm>
				<FormSection
					footer={`Creates ${renderedFolder} / ${renderedFile}.md`}
					title={template.name}
				>
					<FormTextField
						initialValue={template.targetFolderPattern}
						label="Folder"
						onChangeText={setFolder}
						placeholder="Inbox"
					/>
					<FormTextField
						initialValue={template.fileNamePattern}
						label="File name"
						monospace
						onChangeText={setPattern}
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
