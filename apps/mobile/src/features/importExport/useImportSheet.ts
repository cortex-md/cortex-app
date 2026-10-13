import { getErrorMessage, useVaultStore } from "@cortex/core"
import type { ObsidianProgress } from "@cortex/import-export"
import { useCallback, useMemo, useRef, useState } from "react"

import { toast } from "@/features/feedback/useToast"
import {
	pickImportFiles,
	pickImportFolder,
	previewImportFile,
	runFileImport,
	runObsidianImport,
	undoFileImport,
} from "@/features/importExport/importAdapter"
import {
	buildDestinations,
	countPlannedNotes,
	importableCount,
	planImport,
} from "@/features/importExport/importPlan"
import type {
	ConflictPolicy,
	CsvMode,
	DetectChoice,
	ImportDestination,
	ImportPreview,
	ImportRunResult,
	ImportSourceFile,
	ImportStage,
	InspectedFolder,
	ObsidianMode,
	ObsidianOutcome,
} from "@/features/importExport/importTypes"

interface ImportSheetState {
	stage: ImportStage
	files: ImportSourceFile[]
	destinationIndex: number
	conflict: ConflictPolicy
	csvMode: CsvMode
	selectedFileId: string | null
	previews: Record<string, ImportPreview>
	runResult: ImportRunResult | null
	folder: InspectedFolder | null
	detectChoice: DetectChoice
	obsidianMode: ObsidianMode
	destinationFolder: string
	applySettings: boolean
	progress: ObsidianProgress | null
	outcome: ObsidianOutcome | null
	busy: boolean
}

type Attempt<T> = { ok: true; value: T } | { ok: false; error: string }

const EMPTY_PREVIEWS: Record<string, ImportPreview> = {}

const initialState: ImportSheetState = {
	applySettings: true,
	busy: false,
	conflict: "both",
	csvMode: "table",
	destinationFolder: "",
	destinationIndex: 0,
	detectChoice: "obs",
	files: [],
	folder: null,
	obsidianMode: "copy",
	outcome: null,
	previews: EMPTY_PREVIEWS,
	progress: null,
	runResult: null,
	selectedFileId: null,
	stage: "choose",
}

async function attempt<T>(task: Promise<T>): Promise<Attempt<T>> {
	try {
		return { ok: true, value: await task }
	} catch (error) {
		return { error: getErrorMessage(error), ok: false }
	}
}

function previewKey(fileId: string, csvMode: CsvMode): string {
	return `${fileId}:${csvMode}`
}

async function resolvePreview(file: ImportSourceFile, csvMode: CsvMode): Promise<ImportPreview> {
	const result = await attempt(previewImportFile(file, csvMode))
	return result.ok ? result.value : { kind: "unsupported", message: result.error, title: file.name }
}

export function useImportSheet() {
	const vault = useVaultStore((state) => state.vault)
	const vaultFiles = useVaultStore((state) => state.files)
	const [state, setState] = useState<ImportSheetState>(initialState)
	const abortRef = useRef<AbortController | null>(null)

	const patch = useCallback((next: Partial<ImportSheetState>) => {
		setState((current) => ({ ...current, ...next }))
	}, [])

	const vaultPath = vault?.path ?? ""
	const vaultName = vault?.name ?? "this vault"

	const destinations = useMemo<ImportDestination[]>(
		() => buildDestinations(vaultPath, vaultFiles),
		[vaultFiles, vaultPath],
	)
	const destination = destinations[Math.min(state.destinationIndex, destinations.length - 1)]

	const plans = useMemo(
		() =>
			planImport({
				conflict: state.conflict,
				csvMode: state.csvMode,
				destination,
				files: state.files,
				vaultFiles,
				vaultPath,
			}),
		[destination, state.conflict, state.csvMode, state.files, vaultFiles, vaultPath],
	)
	const plannedNotes = countPlannedNotes(plans)
	const importable = importableCount(plans)

	const selectedPlan = plans.find((plan) => plan.file.id === state.selectedFileId) ?? plans[0]
	const selectedPreview = selectedPlan
		? state.previews[previewKey(selectedPlan.file.id, state.csvMode)]
		: undefined

	const loadPreview = useCallback(async (file: ImportSourceFile, csvMode: CsvMode) => {
		const preview = await resolvePreview(file, csvMode)
		const key = previewKey(file.id, csvMode)
		setState((current) => ({ ...current, previews: { ...current.previews, [key]: preview } }))
	}, [])

	const chooseFiles = useCallback(async () => {
		patch({ busy: true })
		const result = await attempt(pickImportFiles())
		if (!result.ok) {
			patch({ busy: false })
			toast(result.error)
			return
		}
		if (result.value.length === 0) {
			patch({ busy: false })
			return
		}
		const picked = result.value
		setState((current) => {
			const known = new Set(current.files.map((file) => file.id))
			const files = [...current.files, ...picked.filter((file) => !known.has(file.id))]
			return { ...current, busy: false, files, stage: "review" }
		})
	}, [patch])

	const chooseFolder = useCallback(async () => {
		patch({ busy: true })
		const result = await attempt(pickImportFolder())
		if (!result.ok) {
			patch({ busy: false })
			toast(result.error)
			return
		}
		const folder = result.value
		if (!folder) {
			patch({ busy: false })
			return
		}
		if (folder.isObsidian) {
			patch({
				busy: false,
				destinationFolder: folder.name,
				detectChoice: "obs",
				folder,
				stage: "detect",
			})
			return
		}
		if (folder.importableFiles.length === 0) {
			patch({ busy: false, folder })
			toast(`No CSV, HTML or PDF files in ${folder.name}.`)
			return
		}
		patch({ busy: false, files: folder.importableFiles, folder, stage: "review" })
	}, [patch])

	const changeFolder = useCallback(async () => {
		patch({ busy: true })
		const result = await attempt(pickImportFolder())
		if (!result.ok) toast(result.error)
		const folder = result.ok ? result.value : null
		patch(folder ? { busy: false, destinationFolder: folder.name, folder } : { busy: false })
	}, [patch])

	const openPreview = useCallback(
		(fileId: string) => {
			const file = state.files.find((item) => item.id === fileId)
			if (!file) return
			patch({ selectedFileId: fileId, stage: "preview" })
			if (!state.previews[previewKey(fileId, state.csvMode)]) void loadPreview(file, state.csvMode)
		},
		[loadPreview, patch, state.csvMode, state.files, state.previews],
	)

	const runImport = useCallback(async () => {
		if (!vault || importable === 0 || state.busy) return
		patch({ busy: true })
		const result = await attempt(runFileImport(plans, destination, state.csvMode))
		if (!result.ok) {
			patch({ busy: false })
			toast(result.error)
			return
		}
		patch({ busy: false, runResult: result.value, stage: "done" })
	}, [destination, importable, patch, plans, state.busy, state.csvMode, vault])

	const undoImport = useCallback(async () => {
		if (!state.runResult || state.busy) return
		patch({ busy: true })
		const result = await attempt(undoFileImport(state.runResult))
		if (!result.ok) {
			patch({ busy: false })
			toast(result.error)
			return
		}
		patch({ busy: false, runResult: null, stage: "review" })
		toast("Import undone")
	}, [patch, state.busy, state.runResult])

	const detectNext = useCallback(() => {
		const folder = state.folder
		if (!folder) return
		if (state.detectChoice === "files") {
			patch({ files: folder.importableFiles, stage: "review" })
			return
		}
		patch({ obsidianMode: state.detectChoice === "open" ? "open" : "copy", stage: "obs" })
	}, [patch, state.detectChoice, state.folder])

	const runObsidian = useCallback(async () => {
		const folder = state.folder
		if (!folder || state.busy) return
		const controller = new AbortController()
		abortRef.current = controller
		const isCopy = state.obsidianMode === "copy"
		patch({
			busy: true,
			outcome: null,
			progress: isCopy ? { completed: 0, total: folder.totalFiles } : null,
			stage: isCopy ? "run" : "obs",
		})
		const result = await attempt(
			runObsidianImport({
				applySettings: state.applySettings,
				destinationFolder: state.destinationFolder,
				folder,
				mode: state.obsidianMode,
				onProgress: (progress) => patch({ progress }),
				signal: controller.signal,
			}),
		)
		abortRef.current = null
		if (!result.ok) {
			patch({ busy: false, progress: null, stage: "obs" })
			toast(result.error)
			return
		}
		patch({ busy: false, outcome: result.value, stage: "obsdone" })
	}, [
		patch,
		state.applySettings,
		state.busy,
		state.destinationFolder,
		state.folder,
		state.obsidianMode,
	])

	const cancelRun = useCallback(() => {
		abortRef.current?.abort()
	}, [])

	const setCsvMode = useCallback(
		(csvMode: CsvMode) => {
			patch({ csvMode })
			const selected = state.files.find((file) => file.id === state.selectedFileId)
			if (selected && !state.previews[previewKey(selected.id, csvMode)]) {
				void loadPreview(selected, csvMode)
			}
		},
		[loadPreview, patch, state.files, state.previews, state.selectedFileId],
	)

	return {
		actions: {
			cancelRun,
			changeFolder,
			chooseFiles,
			chooseFolder,
			detectNext,
			openPreview,
			runImport,
			runObsidian,
			setApplySettings: (applySettings: boolean) => patch({ applySettings }),
			setConflict: (conflict: ConflictPolicy) => patch({ conflict }),
			setCsvMode,
			setDestinationFolder: (destinationFolder: string) => patch({ destinationFolder }),
			setDestinationIndex: (destinationIndex: number) => patch({ destinationIndex }),
			setDetectChoice: (detectChoice: DetectChoice) => patch({ detectChoice }),
			setObsidianMode: (obsidianMode: ObsidianMode) => patch({ obsidianMode }),
			setStage: (stage: ImportStage) => patch({ stage }),
			undoImport,
		},
		derived: {
			destination,
			destinations,
			importable,
			plannedNotes,
			plans,
			selectedPlan,
			selectedPreview,
			vaultName,
			vaultPath,
		},
		state,
	}
}

export type ImportSheetController = ReturnType<typeof useImportSheet>
