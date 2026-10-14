import {
	getErrorMessage,
	getNotePathPresentation,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { Keyboard, Platform, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useCollabNoteSession } from "@/features/collab/collabAdapter"
import { PresenceRow } from "@/features/collab/PresenceRow"
import { NoteConflictBanner } from "@/features/conflict/NoteConflictBanner"
import { NoteEditorScreen } from "@/features/editor/NoteEditorScreen"
import { toast } from "@/features/feedback/useToast"
import { openNote, presentSheet, useActiveNoteTab } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { FindBar } from "@/features/note/FindBar"
import { KeyboardToolbar } from "@/features/note/KeyboardToolbar"
import { buildKeyboardToolbar } from "@/features/note/keyboardToolbarItems"
import { NoteBottomMenu } from "@/features/note/NoteBottomMenu"
import { type NoteDialog, NoteDialogs } from "@/features/note/NoteDialogs"
import {
	buildNoteScreenOptions,
	getModePresentation,
	type NoteHeaderState,
	NoteToolbarIos,
} from "@/features/note/NoteHeader"
import { NotePropertiesBlock } from "@/features/note/NotePropertiesBlock"
import { NoteTitle } from "@/features/note/NoteTitle"
import { insertImageFromLibrary } from "@/features/note/noteImages"
import { buildNoteBottomMenuGroups } from "@/features/note/noteMenu"
import { type FindInNote, useFindInNote } from "@/features/note/useFindInNote"
import { useNoteMenu } from "@/features/note/useNoteMenu"
import { presentPropertyRoute } from "@/features/properties/propertyRoutes"
import { useNoteProperties } from "@/features/properties/useNoteProperties"
import { visiblePropertyDefinitions } from "@/features/properties/visibleProperties"
import { presentInsertTemplate } from "@/features/templates/insertTemplate"
import { useNoteCollabBridge } from "@/features/workspace/collabBridge"
import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function useKeyboardVisible(): boolean {
	const [visible, setVisible] = useState(false)
	useEffect(() => {
		const show = Keyboard.addListener(IS_IOS ? "keyboardWillShow" : "keyboardDidShow", () =>
			setVisible(true),
		)
		const hide = Keyboard.addListener(IS_IOS ? "keyboardWillHide" : "keyboardDidHide", () =>
			setVisible(false),
		)
		return () => {
			show.remove()
			hide.remove()
		}
	}, [])
	return visible
}

function getParam(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
}

async function createUntitledNote(): Promise<void> {
	const { createFile, vault } = useVaultStore.getState()
	if (!vault) return
	try {
		openNote(await createFile(vault.path, "Untitled"))
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function runEditorCommand(commandId: string): void {
	triggerSelectionHaptic()
	workspaceChannel.sendCommand(commandId)
}

function hideKeyboard(): void {
	workspaceChannel.sendCommand("mobile.blur")
	Keyboard.dismiss()
}

function NoteBottomBar({
	editing,
	filePath,
	find,
	keyboardVisible,
}: {
	editing: boolean
	filePath: string | null
	find: FindInNote
	keyboardVisible: boolean
}) {
	const tabCount = useWorkspaceStore((state) => state.panes[state.activePaneId]?.tabs.length ?? 0)
	const insets = useSafeAreaInsets()
	if (find.open) {
		if (!IS_IOS) return null
		return (
			<View style={{ paddingBottom: keyboardVisible ? 0 : insets.bottom }}>
				<FindBar find={find} />
			</View>
		)
	}
	if (editing) {
		const toolbar = buildKeyboardToolbar(
			(commandId) => {
				if (commandId === "format.image" && filePath) void insertImageFromLibrary(filePath)
				else runEditorCommand(commandId)
			},
			() => {
				if (filePath) presentInsertTemplate(filePath)
			},
		)
		return <KeyboardToolbar {...toolbar} onHideKeyboard={hideKeyboard} />
	}
	return (
		<NoteBottomMenu
			groups={buildNoteBottomMenuGroups({
				onFind: () => presentSheet("quick-finder"),
				onNewNote: () => void createUntitledNote(),
				onTabs: () => presentSheet("tabs"),
				tabCount,
			})}
		/>
	)
}

export function NoteScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = getParam(params.filePath)
	useActiveNoteTab(filePath)
	const { colors } = useMobileColors()
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const mode = useEditorStore((state) => state.mode)
	const setMode = useEditorStore((state) => state.setMode)
	const keyboardVisible = useKeyboardVisible()
	const find = useFindInNote()
	const session = useCollabNoteSession(filePath)
	useNoteCollabBridge(filePath, true, workspaceChannel.sendCollab)
	const properties = useNoteProperties(filePath, { trackUsage: false })
	const propertyDefinitions = visiblePropertyDefinitions(properties)
	const [dialog, setDialog] = useState<NoteDialog>("none")
	const [titleEditing, setTitleEditing] = useState(false)
	const title = (filePath && getNotePathPresentation(filePath, vaultPath).title) || "Note"
	const relativePath = filePath && vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? "") : ""
	const editing = keyboardVisible && !find.open && !titleEditing && mode !== "reading"
	const modePresentation = getModePresentation(mode)
	const menuGroups = useNoteMenu({
		filePath,
		onAddProperty:
			filePath && propertyDefinitions.length === 0
				? () => presentPropertyRoute(filePath, "add")
				: undefined,
		onDialog: setDialog,
		onFind: find.show,
		onRename: () => setTitleEditing(true),
		relativePath,
		title,
	})
	const headerState: NoteHeaderState = {
		colors,
		find,
		menuGroups,
		mode: modePresentation,
		onCycleMode: () => {
			triggerSelectionHaptic()
			setMode(modePresentation.next)
		},
		title,
	}

	return (
		<>
			<Stack.Screen options={buildNoteScreenOptions(headerState, IS_IOS)} />
			{IS_IOS ? <NoteToolbarIos state={headerState} /> : null}
			<NoteEditorScreen
				bottom={
					<NoteBottomBar
						editing={editing}
						filePath={filePath}
						find={find}
						keyboardVisible={keyboardVisible}
					/>
				}
				filePath={filePath}
				top={
					<>
						<NoteTitle
							editable={mode !== "reading"}
							editing={titleEditing}
							filePath={filePath}
							onEditingChange={setTitleEditing}
							title={title}
						/>
						<NoteConflictBanner filePath={filePath} vaultPath={vaultPath} />
						{session.live ? <PresenceRow session={session} /> : null}
						<NotePropertiesBlock definitions={propertyDefinitions} properties={properties} />
					</>
				}
			/>
			<NoteDialogs dialog={dialog} filePath={filePath} onClose={() => setDialog("none")} />
		</>
	)
}
