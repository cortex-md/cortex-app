import {
	getErrorMessage,
	type TemplateDefinition,
	type TemplateVault,
	useTemplateStore,
} from "@cortex/core"
import { BottomSheet } from "@expo/ui"
import { Check } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { GroupedList } from "@/components/ui/GroupedList"
import { toast } from "@/features/feedback/useToast"
import { TemplateField } from "@/features/templates/TemplateFields"
import {
	createTemplateContext,
	renderPattern,
	stripMarkdownExtension,
} from "@/features/templates/templatesAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const SAMPLE_NOTE_TITLE = "Design review"

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

function SettingsForm({
	onDone,
	template,
	vault,
}: {
	onDone: () => void
	template: TemplateDefinition
	vault: TemplateVault
}) {
	const { colors } = useMobileColors()
	const [folder, setFolder] = useState(template.targetFolderPattern)
	const [pattern, setPattern] = useState(template.fileNamePattern)
	const [saving, setSaving] = useState(false)

	const context = createTemplateContext(vault, template, SAMPLE_NOTE_TITLE)
	const renderedFolder = renderPattern(folder, context) || "Inbox"
	const renderedFile = stripMarkdownExtension(renderPattern(pattern, context) || SAMPLE_NOTE_TITLE)
	const output = `${renderedFolder} / ${renderedFile}.md`

	function done() {
		if (saving) return
		setSaving(true)
		void saveSettings(vault, template.id, folder.trim(), pattern.trim()).then((saved) => {
			setSaving(false)
			if (saved) onDone()
		})
	}

	return (
		<View style={[styles.sheet, { backgroundColor: colors.groupedBackground }]}>
			{IS_IOS ? (
				<View style={styles.header}>
					<View style={styles.side} />
					<Text style={[styles.title, { color: colors.label }]}>New notes</Text>
					<View style={[styles.side, styles.sideEnd]}>
						<Pressable
							accessibilityLabel="Done"
							accessibilityRole="button"
							disabled={saving}
							onPress={done}
							style={({ pressed }) => [
								styles.doneCircle,
								{ backgroundColor: colors.tintFill, opacity: pressed || saving ? 0.7 : 1 },
							]}
						>
							<Check color={colors.onTint} size={20} strokeWidth={2.6} />
						</Pressable>
					</View>
				</View>
			) : (
				<Text style={[styles.m3Title, { color: colors.label }]}>New notes</Text>
			)}
			{IS_IOS ? (
				<GroupedList>
					<TemplateField label="Folder" onChangeText={setFolder} value={folder} />
					<TemplateField code label="File name" onChangeText={setPattern} value={pattern} />
				</GroupedList>
			) : (
				<View style={styles.m3Fields}>
					<TemplateField label="Folder" onChangeText={setFolder} value={folder} />
					<TemplateField code label="File name" onChangeText={setPattern} value={pattern} />
				</View>
			)}
			<Text style={[styles.footer, { color: colors.secondaryLabel }]}>
				{"Creates "}
				<Text style={[styles.bold, { color: colors.label }]}>{output}</Text>
			</Text>
			{IS_IOS ? null : (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					disabled={saving}
					onPress={done}
					style={[styles.m3Done, { backgroundColor: colors.tintFill, opacity: saving ? 0.7 : 1 }]}
				>
					<Text style={[styles.m3DoneLabel, { color: colors.onTint }]}>Done</Text>
				</Pressable>
			)}
		</View>
	)
}

export function TemplateSettingsSheet({
	isPresented,
	onDismiss,
	template,
	vault,
}: {
	isPresented: boolean
	onDismiss: () => void
	template: TemplateDefinition | null
	vault: TemplateVault | null
}) {
	const { colors } = useMobileColors()
	return (
		<BottomSheet
			containerColor={colors.groupedBackground}
			contentPadding={0}
			isPresented={isPresented && Boolean(template && vault)}
			onDismiss={onDismiss}
		>
			{isPresented && template && vault ? (
				<SettingsForm key={template.id} onDone={onDismiss} template={template} vault={vault} />
			) : null}
		</BottomSheet>
	)
}

const styles = StyleSheet.create({
	bold: {
		fontWeight: "600",
	},
	doneCircle: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	footer: {
		fontSize: IS_IOS ? 13 : 12,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 8,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: 60,
		paddingHorizontal: 14,
	},
	m3Done: {
		alignItems: "center",
		borderRadius: 999,
		height: 48,
		justifyContent: "center",
		marginHorizontal: 16,
		marginTop: 16,
	},
	m3DoneLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	m3Fields: {
		gap: 20,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	m3Title: {
		fontSize: 22,
		lineHeight: 28,
		paddingBottom: 8,
		paddingHorizontal: 24,
		paddingTop: 8,
	},
	sheet: {
		paddingBottom: 30,
	},
	side: {
		minWidth: 44,
	},
	sideEnd: {
		alignItems: "flex-end",
	},
	title: {
		flex: 1,
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
})
