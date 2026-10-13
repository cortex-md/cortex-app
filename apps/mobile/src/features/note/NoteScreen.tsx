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
import { Keyboard, Platform } from "react-native"

import { type CollabNoteSession, useCollabNoteSession } from "@/features/collab/collabAdapter"
import { PresenceRow } from "@/features/collab/PresenceRow"
import { useOpenCommentCount } from "@/features/comments/commentsAdapter"
import { NoteEditorScreen } from "@/features/editor/NoteEditorScreen"
import { toast } from "@/features/feedback/useToast"
import { openNote, presentSheet } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { FindBar } from "@/features/note/FindBar"
import { FloatingNoteToolbar } from "@/features/note/FloatingNoteToolbar"
import { FormattingBar } from "@/features/note/FormattingBar"
import { type NoteDialog, NoteDialogs } from "@/features/note/NoteDialogs"
import {
	buildNoteScreenOptions,
	getModePresentation,
	type NoteHeaderState,
	NoteToolbarIos,
} from "@/features/note/NoteHeader"
import { type FindInNote, useFindInNote } from "@/features/note/useFindInNote"
import { useNoteMenu } from "@/features/note/useNoteMenu"
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

function finishEditing(): void {
	workspaceChannel.sendCommand("mobile.blur")
	Keyboard.dismiss()
}

function NoteBottomBar({
	editing,
	filePath,
	find,
	session,
	title,
}: {
	editing: boolean
	filePath: string | null
	find: FindInNote
	session: CollabNoteSession
	title: string
}) {
	const tabCount = useWorkspaceStore((state) => state.panes[state.activePaneId]?.tabs.length ?? 0)
	const openCommentCount = useOpenCommentCount(filePath)
	if (find.open) return IS_IOS ? <FindBar find={find} /> : null
	if (editing) return <FormattingBar />
	return (
		<FloatingNoteToolbar
			commentCount={session.live ? openCommentCount : null}
			onComments={() => presentSheet("comments", filePath ? { filePath } : undefined)}
			onFind={() => presentSheet("quick-finder")}
			onNewNote={() => void createUntitledNote()}
			onTabs={() => presentSheet("tabs")}
			tabCount={tabCount}
			title={title}
		/>
	)
}

export function NoteScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = getParam(params.filePath)
	const { colors } = useMobileColors()
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const mode = useEditorStore((state) => state.mode)
	const setMode = useEditorStore((state) => state.setMode)
	const keyboardVisible = useKeyboardVisible()
	const find = useFindInNote()
	const session = useCollabNoteSession(filePath)
	const [dialog, setDialog] = useState<NoteDialog>("none")
	const title = (filePath && getNotePathPresentation(filePath, vaultPath).title) || "Note"
	const relativePath = filePath && vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? "") : ""
	const editing = keyboardVisible && !find.open && mode !== "reading"
	const modePresentation = getModePresentation(mode)
	const menuGroups = useNoteMenu({ filePath, onDialog: setDialog, onFind: find.show, relativePath, title })
	const headerState: NoteHeaderState = {
		colors,
		editing,
		find,
		live: session.live,
		liveCount: session.presence.length,
		menuGroups,
		mode: modePresentation,
		onCycleMode: () => {
			triggerSelectionHaptic()
			setMode(modePresentation.next)
		},
		onDone: finishEditing,
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
						session={session}
						title={title}
					/>
				}
				filePath={filePath}
				top={session.live && !editing ? <PresenceRow session={session} /> : null}
			/>
			<NoteDialogs
				dialog={dialog}
				filePath={filePath}
				onClose={() => setDialog("none")}
				relativePath={relativePath}
				title={title}
			/>
		</>
	)
}
