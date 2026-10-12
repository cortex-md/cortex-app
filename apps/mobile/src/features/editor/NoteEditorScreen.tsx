import {
	getNotePathPresentation,
	type NoteDocumentSession,
	type NoteDocumentSnapshot,
	openNoteDocumentSession,
	useVaultStore,
} from "@cortex/core"
import {
	type NativeStackNavigationProp,
	Stack,
	useFocusEffect,
	useLocalSearchParams,
	useNavigation,
} from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native"

import { PluginStatusMenu } from "@/features/plugins/PluginStatusMenu"
import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import type { WorkspaceDocument } from "@/features/workspace/workspaceProtocol"
import { useMobileColors } from "@/hooks/useMobileColors"

type StackNavigation = NativeStackNavigationProp<Record<string, object | undefined>>

const TRANSITION_FALLBACK_MS = 400

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

function getParamValue(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
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

/** Placeholder for the persistent workspace WebView, which is laid over this screen's content. */
export function NoteEditorScreen() {
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = getParamValue(params.filePath)
	const navigation = useNavigation<StackNavigation>()
	const { colors } = useMobileColors()
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const [screenState, setScreenState] = useState<NoteScreenState>(initialNoteScreenState)
	const [editorOwner] = useState(() => ({}))
	const placeholderRef = useRef<View>(null)
	const sessionRef = useRef<NoteDocumentSession | null>(null)
	const focusedRef = useRef(false)
	const transitioningRef = useRef(true)
	const transitionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const showEditor = useCallback(() => {
		const snapshot = sessionRef.current?.getSnapshot()
		if (!focusedRef.current || transitioningRef.current || !snapshot) return
		placeholderRef.current?.measureInWindow((x, y, width, height) => {
			if (!focusedRef.current || transitioningRef.current) return
			workspaceChannel.showEditor(editorOwner, { x, y, width, height })
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
	const displayTitle = filePath
		? screenState.filePath === filePath
			? screenState.title
			: getNoteTitle(filePath, vaultPath)
		: "Editor"

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
			style={[styles.root, { backgroundColor: colors.background }]}
		>
			<Stack.Screen options={{ title: displayTitle }} />
			<PluginStatusMenu />
			{loading || displayError || !filePath ? (
				<View style={styles.messageFrame}>
					<Text selectable style={[styles.messageTitle, { color: colors.label }]}>
						{loading ? "Opening note" : "Could not open note"}
					</Text>
					<Text selectable style={[styles.messageBody, { color: colors.secondaryLabel }]}>
						{loading ? "Loading the local file snapshot." : displayError}
					</Text>
				</View>
			) : (
				<View
					collapsable={false}
					onLayout={showEditor}
					ref={placeholderRef}
					style={styles.editorFrame}
				/>
			)}
		</KeyboardAvoidingView>
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
