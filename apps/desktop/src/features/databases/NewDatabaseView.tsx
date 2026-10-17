import {
	closeNewDatabaseTab,
	convertFolderToDatabase,
	createDatabase,
	getParentPath,
	isMarkdownPath,
	openDatabaseView,
	readNewDatabaseViewState,
	removeDatabase,
	reportAppError,
	toVaultRelativePath,
	useDatabaseStore,
	useTemplateSharingStore,
	useVaultStore,
} from "@cortex/core"
import { DATABASE_PRESETS, type DatabasePreset } from "@cortex/properties/database"
import {
	Avatar,
	AvatarFallback,
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	FolderPicker,
	Input,
	Label,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	ToggleGroup,
	ToggleGroupItem,
} from "@cortex/ui"
import { CheckIcon, ChevronRightIcon, FolderIcon, PlusIcon, Table2Icon } from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { useTemplateFolderOptions } from "../templates/useTemplateFolderOptions"
import "./database.css"

const MAX_FOLDER_SUGGESTIONS = 12
const viewLabels: Record<string, string> = {
	table: "Table",
	board: "Board",
	calendar: "Calendar",
	gallery: "Gallery",
}

interface FolderSuggestion {
	path: string
	label: string
	noteCount: number
}

interface PresetChoice {
	key: string
	preset: DatabasePreset
	sharedBy?: string
	team?: string
}

interface CreatedState {
	folderPath: string
	summary: string
	samplePaths: string[]
	converted: boolean
}

function useFolderSuggestions(): FolderSuggestion[] {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const files = useVaultStore((state) => state.files)
	const databases = useDatabaseStore((state) => state.databases)
	return useMemo(() => {
		if (!vaultPath) return []
		const counts = new Map<string, number>()
		for (const file of files) {
			if (file.isDir || !isMarkdownPath(file.path)) continue
			const parent = getParentPath(file.path)
			if (parent !== vaultPath) counts.set(parent, (counts.get(parent) ?? 0) + 1)
		}
		return [...counts.entries()]
			.filter(([path]) => !databases[path])
			.map(([path, noteCount]) => ({
				path,
				label: toVaultRelativePath(path, vaultPath) ?? path,
				noteCount,
			}))
			.sort(
				(left, right) => right.noteCount - left.noteCount || left.label.localeCompare(right.label),
			)
			.slice(0, MAX_FOLDER_SUGGESTIONS)
	}, [databases, files, vaultPath])
}

function describePreset(preset: DatabasePreset): string {
	const added = preset.properties.map((property) => property.name)
	const parts = [
		added.length > 0 ? `added ${added.join(", ")}` : "",
		formatCount(preset.views.length, "view"),
	].filter(Boolean)
	return parts.join(" · ")
}

function initials(name: string): string {
	return (
		name
			.split(/\s+/)
			.map((part) => part.charAt(0))
			.join("")
			.slice(0, 2)
			.toUpperCase() || "?"
	)
}

export function NewDatabaseView({ viewState }: CoreViewProps) {
	const state = readNewDatabaseViewState(viewState)
	const vault = useVaultStore((store) => store.vault)
	const teamPresets = useTemplateSharingStore((store) => store.teamDatabasePresets)
	const folderOptions = useTemplateFolderOptions()
	const folders = useFolderSuggestions()
	const choices = useMemo<PresetChoice[]>(() => {
		const builtIn = DATABASE_PRESETS.map((preset) => ({ key: preset.id, preset }))
		const team = teamPresets.map((shared) => ({
			key: shared.preset.id,
			preset: shared.preset,
			sharedBy: shared.ownerName,
			team: shared.groupName ?? "your team",
		}))
		const extra =
			state.preset && ![...builtIn, ...team].some((choice) => choice.key === state.preset?.id)
				? [{ key: state.preset.id, preset: state.preset }]
				: []
		return [...builtIn, ...team, ...extra]
	}, [state.preset, teamPresets])
	const [presetKey, setPresetKey] = useState(state.presetKey ?? "empty")
	const [name, setName] = useState("")
	const [parent, setParent] = useState(() =>
		vault && state.parentPath ? (toVaultRelativePath(state.parentPath, vault.path) ?? "") : "",
	)
	const [samples, setSamples] = useState(true)
	const [showFolders, setShowFolders] = useState(state.mode === "convert")
	const [busy, setBusy] = useState(false)
	const [created, setCreated] = useState<CreatedState | null>(null)
	const choice = choices.find((item) => item.key === presetKey) ?? choices[0]
	const preset = choice.preset
	const teamChoices = choices.filter((item) => item.team)
	const ownChoices = choices.filter((item) => !item.team)
	const teamLabel = teamChoices[0]?.team ?? "your team"
	const placeholder = preset.id === "empty" ? "Untitled database" : preset.name
	const parentPath = vault ? (parent ? `${vault.path}/${parent}` : vault.path) : null
	const columns = preset.properties.slice(0, 5)
	const sampleRows = samples ? preset.samples : []

	const create = async (event?: FormEvent) => {
		event?.preventDefault()
		if (!parentPath || busy || created) return
		setBusy(true)
		try {
			const result = await createDatabase({
				parentPath,
				name: name.trim() || placeholder,
				preset,
				samples: samples && preset.samples.length > 0,
			})
			setCreated({
				folderPath: result.folderPath,
				summary: `${name.trim() || placeholder} — ${describePreset(preset)}`,
				samplePaths: result.samplePaths,
				converted: false,
			})
		} catch (error) {
			await reportAppError({
				operation: "database.create",
				source: "databases",
				cause: error,
				userMessage: error instanceof Error ? error.message : "The database could not be created.",
				context: { parentPath },
			})
		} finally {
			setBusy(false)
		}
	}

	const convert = async (folder: FolderSuggestion) => {
		if (busy || created) return
		setBusy(true)
		try {
			await convertFolderToDatabase(folder.path)
			setCreated({
				folderPath: folder.path,
				summary: `${folder.label} — ${formatCount(folder.noteCount, "note")}`,
				samplePaths: [],
				converted: true,
			})
		} catch (error) {
			await reportAppError({
				operation: "database.convert-folder",
				source: "databases",
				cause: error,
				userMessage: "The folder could not be turned into a database.",
				context: { folderPath: folder.path },
			})
		} finally {
			setBusy(false)
		}
	}

	const undo = async () => {
		if (!created || busy) return
		setBusy(true)
		try {
			await removeDatabase(created.folderPath)
			if (!created.converted) await useVaultStore.getState().deleteFile(created.folderPath)
			setCreated(null)
		} finally {
			setBusy(false)
		}
	}

	const open = () => {
		if (!created) return
		openDatabaseView(created.folderPath)
		closeNewDatabaseTab(state.token)
	}

	return (
		<section className="db-page db-new">
			<form className="db-new-column" onSubmit={(event) => void create(event)}>
				<div className="db-new-path">
					<span>{vault?.name ?? "Vault"} /</span>
					<div className="db-new-folder">
						<FolderPicker
							options={folderOptions}
							value={parent}
							onChange={setParent}
							placeholder="Vault root"
							allowCustomValue
						/>
					</div>
				</div>
				<div className="db-new-title">
					<Table2Icon aria-hidden="true" />
					<Input
						autoFocus
						value={name}
						placeholder={placeholder}
						aria-label="Database name"
						disabled={Boolean(created)}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
				<Tabs value={preset.views[0]?.type ?? "table"}>
					<TabsList variant="line" className="db-new-views">
						{(preset.views.length > 0 ? preset.views : [{ type: "table", name: "Table" }]).map(
							(view) => (
								<TabsTrigger key={`${view.type}-${view.name}`} value={view.type} disabled>
									{view.name || viewLabels[view.type]}
								</TabsTrigger>
							),
						)}
					</TabsList>
				</Tabs>
				<div className="db-new-table">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								{columns.map((column) => (
									<TableHead key={column.key}>{column.name}</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{sampleRows.map((sample) => (
								<TableRow key={sample.title} className="db-new-sample">
									<TableCell>{sample.title}</TableCell>
									{columns.map((column) => (
										<TableCell key={column.key}>
											{sample.values[column.key] === undefined ? (
												<span className="db-new-muted">—</span>
											) : (
												String(sample.values[column.key])
											)}
										</TableCell>
									))}
								</TableRow>
							))}
							<TableRow>
								<TableCell colSpan={columns.length + 1} className="db-new-muted">
									<PlusIcon className="db-new-plus" />
									New note
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</div>
				{created ? (
					<output className="db-new-done">
						<span className="db-new-ok">
							<CheckIcon />
						</span>
						<span className="db-new-done-copy">{created.summary}</span>
						<Button
							type="button"
							variant="ghost"
							size="xs"
							disabled={busy}
							onClick={() => void undo()}
						>
							Undo
						</Button>
						<Button type="button" size="xs" onClick={open}>
							Open database
						</Button>
					</output>
				) : (
					<>
						<div className="db-new-start">
							<h4>Start with</h4>
							<ToggleGroup
								type="single"
								className="db-presets"
								value={presetKey}
								onValueChange={(next) => {
									if (next) setPresetKey(next)
								}}
							>
								{ownChoices.map((item) => (
									<ToggleGroupItem key={item.key} value={item.key} className="db-preset">
										<b>{item.preset.name}</b>
										{item.preset.hint && <small>{item.preset.hint}</small>}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
							{teamChoices.length > 0 ? (
								<>
									<h4 className="db-new-team">
										<Avatar className="db-new-avatar">
											<AvatarFallback>{initials(teamLabel)}</AvatarFallback>
										</Avatar>
										From {teamLabel}
									</h4>
									<ToggleGroup
										type="single"
										className="db-presets"
										value={presetKey}
										onValueChange={(next) => {
											if (next) setPresetKey(next)
										}}
									>
										{teamChoices.map((item) => (
											<ToggleGroupItem key={item.key} value={item.key} className="db-preset">
												<b>{item.preset.name}</b>
												<small>shared by {item.sharedBy || "a teammate"}</small>
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								</>
							) : null}
						</div>
						<div className="db-new-actions">
							{preset.samples.length > 0 ? (
								<Label className="db-new-switch">
									<Switch size="sm" checked={samples} onCheckedChange={setSamples} />
									Sample notes
								</Label>
							) : null}
							<span className="flex-1" />
							<Button type="submit" disabled={!parentPath || busy}>
								Create database
							</Button>
						</div>
						<Collapsible open={showFolders} onOpenChange={setShowFolders}>
							<CollapsibleTrigger asChild>
								<Button type="button" variant="ghost" size="xs" className="db-folders-toggle">
									Or use notes you already have
									<ChevronRightIcon data-open={showFolders || undefined} />
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								{folders.length === 0 ? (
									<p className="db-folder-empty">No folders with notes yet.</p>
								) : (
									<div className="db-folders">
										{folders.map((folder) => (
											<Button
												size="sm"
												key={folder.path}
												type="button"
												variant="ghost"
												className="db-folder"
												disabled={busy}
												onClick={() => void convert(folder)}
											>
												<FolderIcon />
												<span className="db-folder-name">{folder.label}/</span>
												<small>{formatCount(folder.noteCount, "note")}</small>
											</Button>
										))}
									</div>
								)}
							</CollapsibleContent>
						</Collapsible>
					</>
				)}
				<p className="db-new-hint">
					{created?.converted
						? "Nothing moved: your notes stay where they are. A small view note holds the views and is hidden from the tree."
						: choice.team
							? `This is your copy — if ${choice.sharedBy || "the author"} updates the template, existing databases stay as they are.`
							: `Each row is a note in ${name.trim() || placeholder}/. Change properties, views and sharing any time from the toolbar.`}
				</p>
			</form>
		</section>
	)
}
