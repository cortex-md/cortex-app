import {
	getNotePathPresentation,
	noteCache,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { projectRawNote, replaceFrontmatterBody } from "@cortex/properties"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useRef, useState } from "react"
import {
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	useColorScheme,
	View,
} from "react-native"

import MobileCodeMirrorEditor from "@/features/editor/MobileCodeMirrorEditor"
import {
	MOBILE_EDITOR_DEFAULT_CONFIG,
	type MobileEditorCursor,
} from "@/features/editor/mobile-editor-contract"
import { getMobileColorScheme, mobileColors } from "@/theme/colors"

interface EditorState {
	body: string
	documentRevision: number
	error: string | null
	filePath: string | null
	frontmatterError: string | null
	frontmatterMeta: Record<string, unknown>
	title: string
}

const initialEditorState: EditorState = {
	body: "",
	documentRevision: 0,
	error: null,
	filePath: null,
	frontmatterError: null,
	frontmatterMeta: {},
	title: "Editor",
}

const domThemeTokensByScheme = {
	light: {
		accent: "#0a84ff",
		background: "#ffffff",
		editorFontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
		editorFontSize: "16px",
		editorLineHeight: "1.55",
		foreground: "#111111",
		mutedForeground: "rgba(60, 60, 67, 0.72)",
		separator: "rgba(60, 60, 67, 0.29)",
		selectionBackground: "rgba(10, 132, 255, 0.28)",
		uiFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		warningBackground: "rgba(255, 149, 0, 0.18)",
		warningForeground: "#5c3b00",
	},
	dark: {
		accent: "#0a84ff",
		background: "#000000",
		editorFontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
		editorFontSize: "16px",
		editorLineHeight: "1.55",
		foreground: "#f5f5f7",
		mutedForeground: "rgba(235, 235, 245, 0.64)",
		separator: "rgba(84, 84, 88, 0.65)",
		selectionBackground: "rgba(10, 132, 255, 0.36)",
		uiFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		warningBackground: "rgba(255, 159, 10, 0.24)",
		warningForeground: "#ffd699",
	},
} as const

function getParamValue(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
}

function isResolvedAssetUrl(src: string): boolean {
	return /^(asset|content|data|file|https?):/u.test(src)
}

function resolveMarkdownAssetPath(src: string, filePath: string): string {
	if (isResolvedAssetUrl(src)) return src
	if (src.startsWith("/")) return src
	const fileDirectory = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : ""
	return fileDirectory ? `${fileDirectory}/${src}` : src
}

function createProjectionState(
	rawContent: string,
	filePath: string,
	vaultPath: string | undefined,
	documentRevision: number,
): EditorState {
	const projection = projectRawNote(rawContent)
	const title = getNotePathPresentation(filePath, vaultPath).title || "Editor"

	return {
		body: projection.body,
		documentRevision,
		error: null,
		filePath,
		frontmatterError: projection.frontmatterError,
		frontmatterMeta: projection.meta,
		title,
	}
}

function markDirtyTabsForFilePath(filePath: string): void {
	const workspace = useWorkspaceStore.getState()
	for (const pane of Object.values(workspace.panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType === "file" && tab.filePath === filePath) {
				workspace.markTabDirty(tab.id, true)
			}
		}
	}
}

async function executeUnsupportedNativeEditorCommand(_commandId: string, _source: string) {}

async function resolveMobileEditorAssetUrl(src: string, sourceFilePath: string) {
	if (isResolvedAssetUrl(src)) return src
	return getPlatform().app.resolveFileAssetUrl(resolveMarkdownAssetPath(src, sourceFilePath))
}

export function NoteEditorScreen() {
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = getParamValue(params.filePath)
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const updateCursor = useEditorStore((state) => state.updateCursor)
	const [editorState, setEditorState] = useState<EditorState>(initialEditorState)
	const [bodyByRevision] = useState(() => new Map<number, string>())
	const currentBodyRef = useRef("")
	const documentRevisionRef = useRef(0)
	const rawContentRef = useRef("")

	const themeTokens = domThemeTokensByScheme[scheme]

	useEffect(() => {
		documentRevisionRef.current = 0
		rawContentRef.current = ""
		currentBodyRef.current = ""
		bodyByRevision.clear()

		if (!filePath) {
			return
		}

		let canceled = false
		const applyRawContent = (rawContent: string) => {
			const projectedBody = projectRawNote(rawContent).body
			const shouldAdvanceRevision =
				documentRevisionRef.current === 0 || projectedBody !== currentBodyRef.current
			const nextRevision = shouldAdvanceRevision
				? documentRevisionRef.current + 1
				: documentRevisionRef.current
			const nextEditorState = createProjectionState(
				rawContent,
				filePath,
				vaultPath,
				nextRevision,
			)
			documentRevisionRef.current = nextRevision
			rawContentRef.current = rawContent
			currentBodyRef.current = nextEditorState.body
			bodyByRevision.set(nextRevision, nextEditorState.body)
			setEditorState(nextEditorState)
		}

		void noteCache
			.readEntry(filePath)
			.then((entry) => {
				if (!canceled) applyRawContent(entry.content)
			})
			.catch((error) => {
				if (!canceled) {
					setEditorState({
						...initialEditorState,
						error: error instanceof Error ? error.message : String(error),
						filePath,
						title: getNotePathPresentation(filePath, vaultPath).title || "Editor",
					})
				}
			})

		const unsubscribe = noteCache.onContentChange(filePath, (_path, content) => {
			if (!canceled) applyRawContent(content)
		})

		return () => {
			canceled = true
			unsubscribe()
		}
	}, [bodyByRevision, filePath, vaultPath])

	async function commitBody(nextBody: string, revision: number) {
		if (!filePath) throw new Error("No note is open")
		const currentRevision = documentRevisionRef.current
		const bodyAtRevision = bodyByRevision.get(revision)
		if (
			revision < currentRevision &&
			(bodyAtRevision === undefined || bodyAtRevision !== currentBodyRef.current)
		) {
			throw new Error("The note changed before this mobile editor commit could be applied.")
		}

		if (nextBody === currentBodyRef.current) return

		const nextRawContent = replaceFrontmatterBody(rawContentRef.current, nextBody)
		const nextEditorState = createProjectionState(
			nextRawContent,
			filePath,
			vaultPath,
			currentRevision,
		)
		rawContentRef.current = nextRawContent
		currentBodyRef.current = nextEditorState.body
		bodyByRevision.set(currentRevision, nextEditorState.body)
		setEditorState(nextEditorState)
		noteCache.write(filePath, nextRawContent)
		markDirtyTabsForFilePath(filePath)
	}

	async function reportCursor(cursor: MobileEditorCursor) {
		updateCursor({
			col: cursor.column,
			line: cursor.line,
			offset: cursor.offset,
		})
	}

	const loading = Boolean(filePath && editorState.filePath !== filePath && !editorState.error)
	const displayError = filePath ? editorState.error : "No note was selected."
	const displayTitle = filePath
		? editorState.filePath === filePath
			? editorState.title
			: getNotePathPresentation(filePath, vaultPath).title || "Editor"
		: "Editor"

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
			style={[styles.root, { backgroundColor: colors.background }]}
		>
			<Stack.Screen options={{ title: displayTitle }} />
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
				<View style={styles.editorFrame}>
					<MobileCodeMirrorEditor
						body={editorState.body}
						commitBody={commitBody}
						documentRevision={editorState.documentRevision}
						dom={{
							containerStyle: styles.domContainer,
							scrollEnabled: false,
						}}
						editorConfig={MOBILE_EDITOR_DEFAULT_CONFIG}
						executeCommand={executeUnsupportedNativeEditorCommand}
						filePath={filePath}
						frontmatterError={editorState.frontmatterError}
						frontmatterMeta={editorState.frontmatterMeta}
						reportCursor={reportCursor}
						resolveAssetUrl={resolveMobileEditorAssetUrl}
						themeTokens={themeTokens}
					/>
				</View>
			)}
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	domContainer: {
		flex: 1,
	},
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
