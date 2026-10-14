import {
	getNotePathPresentation,
	type NoteDocumentSession,
	type NoteDocumentSnapshot,
	openNoteDocumentSession,
	useVaultStore,
} from "@cortex/core"
import { type NativeStackNavigationProp, useFocusEffect, useNavigation } from "expo-router"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import {
	Dimensions,
	Keyboard,
	type KeyboardEvent,
	Platform,
	StyleSheet,
	Text,
	View,
} from "react-native"

import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import type { WorkspaceDocument } from "@/features/workspace/workspaceProtocol"
import { useMobileColors } from "@/hooks/useMobileColors"

type StackNavigation = NativeStackNavigationProp<Record<string, object | undefined>>

const TRANSITION_FALLBACK_MS = 250
const IS_IOS = Platform.OS === "ios"

function keyboardTopFrom(event: KeyboardEvent): number | null {
	const top = event.endCoordinates.screenY
	return top >= Dimensions.get("window").height ? null : top
}

interface NoteScreenState {
	error: string | null
	filePath: string | null
	title: string
}

const initialNoteScreenState: NoteScreenState = {
	error: null,
	filePath: null,
	title: "Editor",
}

function getNoteTitle(filePath: string, vaultPath: string | undefined): string {
	return getNotePathPresentation(filePath, vaultPath).title || "Editor"
}

function toWorkspaceDocument(snapshot: NoteDocumentSnapshot): WorkspaceDocument {
	return {
		filePath: snapshot.filePath,
		body: snapshot.body,
		revision: snapshot.revision,
		frontmatterMeta: snapshot.projection.meta,
		frontmatterError: snapshot.projection.frontmatterError,
	}
}

export function NoteEditorScreen({
	bottom,
	filePath,
	top,
}: {
	bottom?: ReactNode
	filePath: string | null
	top?: ReactNode
}) {
	const navigation = useNavigation<StackNavigation>()
	const { colors } = useMobileColors()
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const [screenState, setScreenState] = useState<NoteScreenState>(initialNoteScreenState)
	const [editorOwner] = useState(() => ({}))
	const placeholderRef = useRef<View>(null)
	const keyboardTopRef = useRef<number | null>(null)
	const sessionRef = useRef<NoteDocumentSession | null>(null)
	const focusedRef = useRef(false)
	const transitioningRef = useRef(true)
	const transitionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const showEditor = useCallback(() => {
		const snapshot = sessionRef.current?.getSnapshot()
		if (!focusedRef.current || transitioningRef.current || !snapshot) return
		placeholderRef.current?.measureInWindow((x, y, width, height) => {
			if (!focusedRef.current || transitioningRef.current) return
			const bottom = Math.min(y + height, keyboardTopRef.current ?? Number.POSITIVE_INFINITY)
			workspaceChannel.showEditor(editorOwner, { x, y, width, height: Math.max(bottom - y, 0) })
		})
	}, [editorOwner])

	const clearTransitionFallback = useCallback(() => {
		if (transitionFallbackRef.current === null) return
		clearTimeout(transitionFallbackRef.current)
		transitionFallbackRef.current = null
	}, [])

	const finishTransition = useCallback(() => {
		clearTransitionFallback()
		transitioningRef.current = false
		showEditor()
	}, [clearTransitionFallback, showEditor])

	const armTransitionFallback = useCallback(() => {
		clearTransitionFallback()
		if (!transitioningRef.current) return
		transitionFallbackRef.current = setTimeout(finishTransition, TRANSITION_FALLBACK_MS)
	}, [clearTransitionFallback, finishTransition])

	useEffect(() => {
		if (!filePath) return

		const session = openNoteDocumentSession(filePath, {
			onChange: (snapshot) => {
				setScreenState({
					error: null,
					filePath: snapshot.filePath,
					title: getNoteTitle(snapshot.filePath, vaultPath),
				})
				if (!focusedRef.current) return
				workspaceChannel.showDocument(toWorkspaceDocument(snapshot))
				showEditor()
			},
			onError: (error) => {
				setScreenState({
					error: error instanceof Error ? error.message : String(error),
					filePath,
					title: getNoteTitle(filePath, vaultPath),
				})
			},
		})
		sessionRef.current = session
		const releaseDocument = workspaceChannel.registerDocument(session)

		return () => {
			if (sessionRef.current === session) sessionRef.current = null
			workspaceChannel.hideEditor(editorOwner)
			releaseDocument()
		}
	}, [editorOwner, filePath, showEditor, vaultPath])

	useEffect(() => {
		const unsubscribers: (() => void)[] = []
		for (
			let current: StackNavigation | undefined = navigation;
			current;
			current = current.getParent<StackNavigation | undefined>()
		) {
			unsubscribers.push(
				current.addListener("transitionStart", () => {
					transitioningRef.current = true
					workspaceChannel.hideEditor(editorOwner)
					if (focusedRef.current) armTransitionFallback()
				}),
				current.addListener("transitionEnd", (event) => {
					if (event.data.closing) return
					finishTransition()
				}),
			)
		}
		return () => {
			for (const unsubscribe of unsubscribers) unsubscribe()
		}
	}, [armTransitionFallback, editorOwner, finishTransition, navigation])

	useEffect(() => {
		const update = (top: number | null) => {
			keyboardTopRef.current = top
			showEditor()
		}
		const subscriptions = IS_IOS
			? [
					Keyboard.addListener("keyboardWillChangeFrame", (event) =>
						update(keyboardTopFrom(event)),
					),
					Keyboard.addListener("keyboardWillHide", () => update(null)),
				]
			: [
					Keyboard.addListener("keyboardDidShow", (event) => update(keyboardTopFrom(event))),
					Keyboard.addListener("keyboardDidHide", () => update(null)),
				]
		return () => {
			for (const subscription of subscriptions) subscription.remove()
		}
	}, [showEditor])

	useEffect(() => {
		workspaceChannel.setChrome(editorOwner, bottom)
	}, [bottom, editorOwner])

	useEffect(() => () => workspaceChannel.clearChrome(editorOwner), [editorOwner])

	useFocusEffect(
		useCallback(() => {
			focusedRef.current = true
			const snapshot = sessionRef.current?.getSnapshot()
			if (snapshot) workspaceChannel.showDocument(toWorkspaceDocument(snapshot))
			showEditor()
			armTransitionFallback()
			return () => {
				focusedRef.current = false
				clearTransitionFallback()
				workspaceChannel.hideEditor(editorOwner)
			}
		}, [armTransitionFallback, clearTransitionFallback, editorOwner, showEditor]),
	)

	const loading = Boolean(filePath && screenState.filePath !== filePath && !screenState.error)
	const displayError = filePath ? screenState.error : "No note was selected."
	const showMessage = loading || Boolean(displayError) || !filePath
	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			{top}
			{showMessage ? (
				<>
					<View style={styles.messageFrame}>
						<Text selectable style={[styles.messageTitle, { color: colors.label }]}>
							{loading ? "Opening note" : "Could not open note"}
						</Text>
						<Text selectable style={[styles.messageBody, { color: colors.secondaryLabel }]}>
							{loading ? "Loading the local file snapshot." : displayError}
						</Text>
					</View>
					{bottom}
				</>
			) : (
				<View
					collapsable={false}
					onLayout={showEditor}
					ref={placeholderRef}
					style={styles.editorFrame}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	editorFrame: {
		flex: 1,
		minHeight: 0,
	},
	messageBody: {
		fontSize: 16,
		lineHeight: 22,
		textAlign: "center",
	},
	messageFrame: {
		alignItems: "center",
		flex: 1,
		gap: 8,
		justifyContent: "center",
		padding: 24,
	},
	messageTitle: {
		fontSize: 22,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 28,
		textAlign: "center",
	},
	root: {
		flex: 1,
	},
})
