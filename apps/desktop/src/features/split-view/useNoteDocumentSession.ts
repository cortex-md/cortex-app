import {
	type EditorMode,
	type NoteDocumentSession,
	type NoteDocumentSnapshot,
	noteCache,
	openNoteDocumentSession,
	useEditorStore,
} from "@cortex/core"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { type PropertyMap, projectRawNote, type RawNoteProjection } from "@cortex/properties"
import { updateFrontmatterEditorState } from "@cortex/properties/codemirror"
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

export interface NoteDocumentState {
	filePath: string
	body: string
	projection: RawNoteProjection
}

export interface FrontmatterState {
	meta: PropertyMap
	error: string | null
}

interface NoteDocumentSessionOptions {
	filePath: string
	isActive: boolean
	live?: boolean
	mode: EditorMode
	viewRef: RefObject<EditorRuntimeView | null>
}

const BODY_RENDER_SYNC_DELAY_MS = 250

export function useNoteDocumentSession({
	filePath,
	isActive,
	live = false,
	mode,
	viewRef,
}: NoteDocumentSessionOptions) {
	const [documentState, setDocumentState] = useState<NoteDocumentState | null>(() =>
		readCachedNoteDocument(filePath),
	)
	const [loadError, setLoadError] = useState<{ filePath: string; message: string } | null>(null)
	const sessionRef = useRef<NoteDocumentSession | null>(null)
	const renderedBodyRef = useRef<string | null>(documentState?.body ?? null)
	const bodySyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isActiveRef = useRef(isActive)
	const liveRef = useRef(live)
	liveRef.current = live
	const frontmatterStateRef = useRef<FrontmatterState>({ meta: {}, error: null })

	const publishRenderedBody = useCallback((documentFilePath: string, body: string) => {
		if (isActiveRef.current) useEditorStore.getState().updateDocument(documentFilePath, body)
	}, [])

	const updateProjectedFrontmatter = useCallback(
		(projection: RawNoteProjection) => {
			frontmatterStateRef.current = {
				meta: projection.meta,
				error: projection.frontmatterError,
			}
			const view = viewRef.current
			if (view) {
				void updateFrontmatterEditorState(
					view,
					frontmatterStateRef.current.meta,
					frontmatterStateRef.current.error,
				)
			}
		},
		[viewRef],
	)

	const syncRenderedBody = useCallback(() => {
		if (bodySyncTimerRef.current) clearTimeout(bodySyncTimerRef.current)
		bodySyncTimerRef.current = null
		const snapshot = sessionRef.current?.getSnapshot()
		if (!snapshot || snapshot.body === renderedBodyRef.current) return
		renderedBodyRef.current = snapshot.body
		setDocumentState((current) =>
			current?.filePath === snapshot.filePath ? { ...current, body: snapshot.body } : current,
		)
		publishRenderedBody(snapshot.filePath, snapshot.body)
	}, [publishRenderedBody])

	const applySessionSnapshot = useCallback(
		(snapshot: NoteDocumentSnapshot) => {
			if (bodySyncTimerRef.current) clearTimeout(bodySyncTimerRef.current)
			bodySyncTimerRef.current = null
			updateProjectedFrontmatter(snapshot.projection)
			const view = viewRef.current
			const bodyChanged = snapshot.body !== renderedBodyRef.current
			if (!bodyChanged && view && !liveRef.current) {
				const editorBody = view.state.doc.toString()
				if (editorBody !== snapshot.body) {
					view.dispatch({ changes: { from: 0, to: editorBody.length, insert: snapshot.body } })
				}
			}
			renderedBodyRef.current = snapshot.body
			setDocumentState((current) =>
				current?.filePath === snapshot.filePath &&
				current.body === snapshot.body &&
				(current.projection === snapshot.projection ||
					current.projection.rawContent === snapshot.projection.rawContent)
					? current
					: { filePath: snapshot.filePath, body: snapshot.body, projection: snapshot.projection },
			)
			if (bodyChanged) publishRenderedBody(snapshot.filePath, snapshot.body)
		},
		[updateProjectedFrontmatter, publishRenderedBody, viewRef],
	)

	useEffect(() => {
		const session = openNoteDocumentSession(filePath, {
			onChange: applySessionSnapshot,
			onError: (error) => {
				renderedBodyRef.current = null
				setDocumentState(null)
				setLoadError({
					filePath,
					message: error instanceof Error ? error.message : String(error),
				})
			},
		})
		sessionRef.current = session
		return () => {
			session.dispose()
			if (sessionRef.current === session) sessionRef.current = null
			if (bodySyncTimerRef.current) clearTimeout(bodySyncTimerRef.current)
			bodySyncTimerRef.current = null
		}
	}, [filePath, applySessionSnapshot])

	useEffect(() => {
		isActiveRef.current = isActive
		const body = renderedBodyRef.current
		if (isActive && body !== null) useEditorStore.getState().updateDocument(filePath, body)
	}, [isActive, filePath])

	// biome-ignore lint/correctness/useExhaustiveDependencies: mode is the trigger for rendering the latest session body
	useLayoutEffect(() => {
		syncRenderedBody()
	}, [mode, syncRenderedBody])

	const handleChange = useCallback(
		(newBody: string) => {
			sessionRef.current?.updateBody(newBody)
			if (bodySyncTimerRef.current) clearTimeout(bodySyncTimerRef.current)
			bodySyncTimerRef.current = setTimeout(syncRenderedBody, BODY_RENDER_SYNC_DELAY_MS)
		},
		[syncRenderedBody],
	)

	return {
		documentState,
		loadError: loadError?.filePath === filePath ? loadError.message : null,
		frontmatterStateRef,
		handleChange,
	}
}

function readCachedNoteDocument(filePath: string): NoteDocumentState | null {
	const entry = noteCache.getEntry(filePath)
	if (!entry) return null
	const projection = projectRawNote(entry.content)
	return { filePath, body: projection.body, projection }
}
