import type { CSSProperties } from "react"

export const FILE_TREE_ROW_HEIGHT = 25
export const FILE_TREE_ROW_STEP = 27

const FILE_TREE_INDENT = 18
const FILE_TREE_BASE_INDENT = 10

interface FileTreeDepthStyle extends CSSProperties {
	"--file-tree-depth": number
	"--file-tree-guide-width": string
	"--file-tree-indent": string
	"--file-tree-row-height": string
}

export function getFileTreeDepthStyle(depth: number): FileTreeDepthStyle {
	return {
		"--file-tree-depth": depth,
		"--file-tree-guide-width": `${depth * FILE_TREE_INDENT}px`,
		"--file-tree-indent": `${depth * FILE_TREE_INDENT + FILE_TREE_BASE_INDENT}px`,
		"--file-tree-row-height": `${FILE_TREE_ROW_HEIGHT}px`,
	}
}
