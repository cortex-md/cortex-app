export interface MobileEditorCursor {
	line: number
	column: number
	offset: number
}

export interface MobileEditorConfig {
	readOnly: boolean
	livePreview: boolean
	fontSize: number
	wordWrap: boolean
	folding: boolean
	tabSize: number
	useSpaces: boolean
	showLineNumbers: boolean
	vimMode: boolean
}

export interface MobileCodeMirrorEditorProps {
	filePath: string
	body: string
	documentRevision: number
	editorConfig: MobileEditorConfig
	frontmatterMeta: Record<string, unknown>
	frontmatterError: string | null
	themeTokens: Record<string, string>
	commitBody: (body: string, revision: number) => Promise<void>
	reportCursor: (cursor: MobileEditorCursor) => Promise<void>
	executeCommand: (commandId: string, source: string) => Promise<void>
	resolveAssetUrl: (src: string, filePath: string) => Promise<string>
	dom?: import("expo/dom").DOMProps
}

export const MOBILE_EDITOR_DEFAULT_CONFIG: MobileEditorConfig = {
	folding: true,
	fontSize: 16,
	livePreview: true,
	readOnly: false,
	showLineNumbers: false,
	tabSize: 2,
	useSpaces: true,
	vimMode: false,
	wordWrap: true,
}
