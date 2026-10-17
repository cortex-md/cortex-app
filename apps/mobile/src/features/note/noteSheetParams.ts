import { useEditorStore } from "@cortex/core"
import { useLocalSearchParams } from "expo-router"

export function useSheetFilePath(): string | null {
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const value = Array.isArray(params.filePath) ? params.filePath[0] : params.filePath
	return value ?? activeFilePath
}
