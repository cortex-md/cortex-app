import type { NoteHeading } from "@cortex/core"
import { getNoteTitle } from "@cortex/platform/utils"
import { Stack } from "expo-router"
import { Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openNote } from "@/features/navigation/routes"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import {
	listUnlinkedMentions,
	revealHeading,
	useNoteBacklinks,
	useNoteHeadings,
} from "@/features/note/useNoteOutline"

const IS_IOS = Platform.OS === "ios"
const INDENT = " "

function plainContext(context: string): string {
	return context.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_match, target, _alias, alias) =>
		String(alias ?? target),
	)
}

function headingRows(headings: NoteHeading[]) {
	const minLevel = Math.min(...headings.map((heading) => heading.level))
	return headings.map((heading) => (
		<FormRow
			key={`${heading.line}-${heading.text}`}
			onPress={() => {
				revealHeading(heading)
				dismissSheet()
			}}
			title={`${INDENT.repeat(heading.level - minLevel)}${heading.text}`}
		/>
	))
}

export function OutlineSheet() {
	const filePath = useSheetFilePath()
	const headings = useNoteHeadings(filePath)
	const backlinks = useNoteBacklinks(filePath)
	const unlinked = listUnlinkedMentions(filePath)
	const noteTitle = filePath ? getNoteTitle(filePath) : "this note"

	return (
		<>
			<Stack.Screen
				options={{
					title: "Outline",
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ sf: "xmark", md: "close" }}
									onPress={dismissSheet}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button onPress={dismissSheet} variant="done">
						Done
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<NativeForm>
				<FormSection
					footer={headings.length === 0 ? "Headings in this note show up here." : undefined}
					title="Headings"
				>
					{headings.length > 0 ? headingRows(headings) : null}
				</FormSection>
				<FormSection
					footer={backlinks.length === 0 ? "Notes that link here show up here." : undefined}
					title={`Backlinks · ${backlinks.length}`}
				>
					{backlinks.map((backlink) => (
						<FormRow
							chevron
							icon={{ sf: "doc.text", md: "description" }}
							key={backlink.sourcePath}
							onPress={() => {
								dismissSheet()
								openNote(backlink.sourcePath)
							}}
							subtitle={plainContext(backlink.context) || undefined}
							title={backlink.title}
						/>
					))}
				</FormSection>
				{unlinked.length > 0 ? (
					<FormSection title="Unlinked mentions">
						{unlinked.map((mention) => (
							<FormRow
								icon={{ sf: "link.badge.plus", md: "add_link" }}
								key={mention.sourcePath}
								onPress={() => toast(`Linked ${mention.title} to ${noteTitle}`)}
								subtitle={mention.context}
								title={mention.title}
							/>
						))}
					</FormSection>
				) : null}
			</NativeForm>
		</>
	)
}
