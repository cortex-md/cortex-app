import {
	convertFolderToDatabase,
	createDatabase,
	getBaseName,
	getErrorMessage,
	type SharedDatabasePreset,
	toVaultRelativePath,
	useTemplateSharingStore,
	useVaultStore,
} from "@cortex/core"
import { DATABASE_PRESETS, type DatabasePreset } from "@cortex/properties/database"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { type ReactNode, useMemo, useState } from "react"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"
import { listTeamDatabasePresets } from "@/features/database/databaseAdapter"
import { firstName, noteCountLabel } from "@/features/database/databaseFormat"
import { readParam } from "@/features/database/databaseNavigation"
import {
	type FolderCandidate,
	type FolderScan,
	useFolderCandidates,
	useFolderScans,
} from "@/features/database/useFolderCandidates"
import { toast } from "@/features/feedback/useToast"
import { FormChoiceRow, FormPicker, FormTextField } from "@/features/importExport/FormFields"
import { HeaderActions } from "@/features/importExport/HeaderActions"
import { openDatabase } from "@/features/navigation/routes"
import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"
import { triggerSelectionHaptic } from "@/utils/haptics"

const UNTITLED = "Untitled database"
const PRESET_ICONS: Record<string, SymbolName> = {
	contacts: { md: "work", sf: "briefcase" },
	empty: { md: "add", sf: "plus" },
	meetings: { md: "groups", sf: "person.2" },
	projects: { md: "table", sf: "tablecells" },
	reading: { md: "menu_book", sf: "book" },
}
const TABLE_ICON: SymbolName = { md: "table", sf: "tablecells" }
const TEAM_ICON: SymbolName = { md: "view_kanban", sf: "rectangle.split.3x1" }

type Choice =
	| { kind: "preset"; preset: DatabasePreset; team?: SharedDatabasePreset }
	| { kind: "folder"; folder: FolderCandidate }

function choiceKey(choice: Choice | null): string {
	if (!choice) return "none"
	if (choice.kind === "folder") return `folder:${choice.folder.path}`
	return `preset:${choice.team?.shareId ?? choice.preset.id}`
}

function describeChoice(choice: Choice, title: string, scan: FolderScan | undefined): string {
	if (choice.kind === "folder") {
		const properties = scan?.keys.length ?? 0
		return `${noteCountLabel(choice.folder.noteCount)} and ${properties} ${properties === 1 ? "property" : "properties"} stay where they are. A view note, ${choice.folder.name}.md, holds the views.`
	}
	const { team } = choice
	if (team) {
		return `Each row is a note in ${title}/. This is your copy: if ${firstName(team.ownerName)} updates the template, this database stays as it is.`
	}
	return `Each row is a note in ${title}/.`
}

async function submitChoice(
	choice: Choice,
	parentPath: string,
	name: string,
	samples: boolean,
): Promise<string | null> {
	try {
		if (choice.kind === "folder") {
			await convertFolderToDatabase(choice.folder.path)
			return choice.folder.path
		}
		const created = await createDatabase({
			name,
			parentPath,
			preset: choice.preset,
			samples: samples && choice.preset.samples.length > 0,
		})
		return created.folderPath
	} catch (error) {
		toast(getErrorMessage(error))
		return null
	}
}

function folderSubtitle(folder: FolderCandidate, scan: FolderScan | undefined): string {
	if (!scan) return noteCountLabel(folder.noteCount)
	const properties = scan.keys.length
	return `${noteCountLabel(folder.noteCount)} · ${properties} ${properties === 1 ? "property" : "properties"}`
}

export function NewDatabaseScreen() {
	const params = useLocalSearchParams<{
		parentPath?: string | string[]
		start?: string | string[]
	}>()
	const stackOptions = useStackScreenOptions()
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const sharedPresets = useTemplateSharingStore((state) => state.teamDatabasePresets)
	const teamPresets = useMemo(() => listTeamDatabasePresets(sharedPresets), [sharedPresets])
	const candidates = useFolderCandidates()
	const [name, setName] = useState("")
	const [parentPath, setParentPath] = useState(
		() => readParam(params.parentPath) ?? vault?.path ?? "",
	)
	const [choice, setChoice] = useState<Choice | null>(null)
	const [samples, setSamples] = useState(true)
	const [busy, setBusy] = useState(false)
	const foldersFirst = readParam(params.start) === "folder"
	const scans = useFolderScans(candidates, foldersFirst || choice?.kind === "folder")
	const presetName =
		choice?.kind === "preset" && choice.preset.id !== "empty" ? choice.preset.name : UNTITLED
	const title = name.trim() || presetName
	const scan = choice?.kind === "folder" ? scans.get(choice.folder.path) : undefined

	const locationOptions = useMemo(() => {
		if (!vault) return []
		const folders = files
			.filter(
				(file) => file.isDir && toVaultRelativePath(file.path, vault.path)?.split("/").length === 1,
			)
			.slice(0, 12)
		const options = [
			{ label: vault.name, value: vault.path },
			...folders.map((folder) => ({ label: getBaseName(folder.path), value: folder.path })),
		]
		if (parentPath && !options.some((option) => option.value === parentPath)) {
			options.push({
				label: toVaultRelativePath(parentPath, vault.path) ?? getBaseName(parentPath),
				value: parentPath,
			})
		}
		return options
	}, [files, parentPath, vault])

	function choosePreset(preset: DatabasePreset, team?: SharedDatabasePreset) {
		triggerSelectionHaptic()
		setChoice({ kind: "preset", preset, team })
		if (!name.trim() && preset.id !== "empty") setName(preset.name)
	}

	function chooseFolder(folder: FolderCandidate) {
		triggerSelectionHaptic()
		setChoice({ folder, kind: "folder" })
		setName(folder.name)
	}

	async function finish() {
		if (!choice || busy || !parentPath) return
		setBusy(true)
		const folderPath = await submitChoice(choice, parentPath, title, samples)
		setBusy(false)
		if (!folderPath) return
		if (router.canGoBack()) router.back()
		openDatabase(folderPath)
	}

	function cancel() {
		if (router.canGoBack()) router.back()
	}

	const isSelectedPreset = (preset: DatabasePreset, team?: SharedDatabasePreset) =>
		choice?.kind === "preset" &&
		choice.preset.id === preset.id &&
		choice.team?.shareId === team?.shareId

	const presetsSection = (
		<FormSection key="presets" title="Start with">
			{DATABASE_PRESETS.map((preset) => (
				<FormChoiceRow
					icon={PRESET_ICONS[preset.id] ?? TABLE_ICON}
					key={preset.id}
					onPress={() => choosePreset(preset)}
					selected={isSelectedPreset(preset)}
					subtitle={preset.id === "empty" ? "No properties yet" : preset.hint}
					title={preset.name}
				/>
			))}
		</FormSection>
	)

	const teamSection =
		teamPresets.length > 0 ? (
			<FormSection key="team" title={`From ${teamPresets[0].groupName ?? "your team"}`}>
				{teamPresets.map((shared) => (
					<FormChoiceRow
						icon={TEAM_ICON}
						key={shared.shareId}
						onPress={() => choosePreset(shared.preset, shared)}
						selected={isSelectedPreset(shared.preset, shared)}
						subtitle={`Shared by ${firstName(shared.ownerName)}`}
						title={shared.preset.name}
					/>
				))}
			</FormSection>
		) : null

	const foldersSection =
		candidates.length > 0 ? (
			<FormSection key="folders" title="Use notes you already have">
				{candidates.map((folder) => (
					<FormChoiceRow
						icon={{ md: "folder", sf: "folder" }}
						key={folder.path}
						onPress={() => chooseFolder(folder)}
						selected={choice?.kind === "folder" && choice.folder.path === folder.path}
						subtitle={folderSubtitle(folder, scans.get(folder.path))}
						title={folder.label}
					/>
				))}
			</FormSection>
		) : null

	const startSections: ReactNode[] = foldersFirst
		? [foldersSection, presetsSection, teamSection]
		: [presetsSection, teamSection, foldersSection]

	return (
		<>
			<Stack.Screen
				options={{
					...stackOptions,
					headerLargeTitleEnabled: false,
					headerShown: true,
					title: "New database",
				}}
			/>
			<HeaderActions
				left={{ label: "Cancel", onPress: cancel }}
				right={{
					disabled: !choice || busy,
					label: "Create",
					onPress: () => void finish(),
					primary: true,
				}}
			/>
			<NativeForm>
				<FormSection footer={choice ? describeChoice(choice, title, scan) : undefined}>
					{choice?.kind === "folder" ? (
						<FormRow
							icon={TABLE_ICON}
							title={choice.folder.label}
							value={noteCountLabel(choice.folder.noteCount)}
						/>
					) : (
						<FormTextField
							initialValue={name}
							key={choiceKey(choice)}
							label="Name"
							onChangeText={setName}
							placeholder={UNTITLED}
						/>
					)}
					{choice?.kind === "folder" ? null : (
						<FormPicker
							label="Location"
							onChange={setParentPath}
							options={locationOptions}
							value={parentPath}
						/>
					)}
					{choice?.kind === "preset" && choice.preset.samples.length > 0 ? (
						<FormToggle onValueChange={setSamples} title="Sample notes" value={samples} />
					) : null}
				</FormSection>
				{startSections}
			</NativeForm>
		</>
	)
}
