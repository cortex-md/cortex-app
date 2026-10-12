import {
	convertFolderToDatabase,
	createDatabase,
	getParentPath,
	isMarkdownPath,
	reportAppError,
	toVaultRelativePath,
	useDatabaseStore,
	useVaultStore,
} from "@cortex/core"
import { DATABASE_PRESETS } from "@cortex/properties/database"
import {
	Button,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Label,
	Switch,
	ToggleGroup,
	ToggleGroupItem,
} from "@cortex/ui"
import { ChevronRightIcon, FolderIcon } from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import { ModalStoreHost } from "@/utils/ModalHost"
import { openDatabaseView } from "./databaseWorkspace"
import { type NewDatabaseTarget, newDatabaseModal } from "./newDatabaseModal"
import "./database.css"

export function NewDatabaseHost() {
	return (
		<ModalStoreHost store={newDatabaseModal}>
			{(target) => <NewDatabaseContent target={target} />}
		</ModalStoreHost>
	)
}

const MAX_FOLDER_SUGGESTIONS = 12

interface FolderSuggestion {
	path: string
	label: string
	noteCount: number
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

function FolderSuggestions({ onPick }: { onPick: (path: string) => void }) {
	const folders = useFolderSuggestions()
	if (folders.length === 0) {
		return <p className="db-folder-empty">No folders with notes yet.</p>
	}
	return (
		<div className="db-folders">
			{folders.map((folder) => (
				<Button
					key={folder.path}
					type="button"
					variant="ghost"
					className="db-folder"
					onClick={() => onPick(folder.path)}
				>
					<FolderIcon />
					<span className="db-folder-name">{folder.label}/</span>
					<small>{formatCount(folder.noteCount, "note")}</small>
				</Button>
			))}
		</div>
	)
}

function NewDatabaseContent({ target }: { target: NewDatabaseTarget }) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [name, setName] = useState("")
	const [presetId, setPresetId] = useState("projects")
	const [samples, setSamples] = useState(true)
	const [creating, setCreating] = useState(false)
	const [showFolders, setShowFolders] = useState(target.mode === "convert")
	const preset = DATABASE_PRESETS.find((item) => item.id === presetId) ?? DATABASE_PRESETS[0]
	const parentPath = target.parentPath ?? vaultPath

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (!parentPath || creating) return
		setCreating(true)
		try {
			const created = await createDatabase({
				parentPath,
				name: name.trim() || (preset.id === "empty" ? "Untitled database" : preset.name),
				presetId: preset.id,
				samples: samples && preset.samples.length > 0,
			})
			newDatabaseModal.close()
			openDatabaseView(created.folderPath)
		} catch (error) {
			await reportAppError({
				operation: "database.create",
				source: "databases",
				cause: error,
				userMessage: error instanceof Error ? error.message : "The database could not be created.",
				context: { parentPath },
			})
		} finally {
			setCreating(false)
		}
	}

	const convert = async (folderPath: string) => {
		if (creating) return
		setCreating(true)
		try {
			await convertFolderToDatabase(folderPath)
			newDatabaseModal.close()
			openDatabaseView(folderPath)
		} catch (error) {
			await reportAppError({
				operation: "database.convert-folder",
				source: "databases",
				cause: error,
				userMessage: "The folder could not be turned into a database.",
				context: { folderPath },
			})
		} finally {
			setCreating(false)
		}
	}

	return (
		<DialogContent className="db-dialog gap-0 overflow-hidden p-0 sm:max-w-[560px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>New database</DialogTitle>
				<DialogDescription>
					Each row is a note in a new folder. Change properties and views any time.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={submit}>
				<DialogBody className="dialog-chrome-body">
					<FieldGroup>
						<Field>
							<Label htmlFor="new-database-name">Name</Label>
							<Input
								id="new-database-name"
								value={name}
								placeholder={preset.id === "empty" ? "Untitled database" : preset.name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Start with</FieldLabel>
							<ToggleGroup
								type="single"
								className="db-presets"
								value={presetId}
								onValueChange={(next) => {
									if (next) setPresetId(next)
								}}
							>
								{DATABASE_PRESETS.map((item) => (
									<ToggleGroupItem key={item.id} value={item.id} className="db-preset">
										<b>{item.name}</b>
										{item.hint && <small>{item.hint}</small>}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</Field>
						{preset.samples.length > 0 && (
							<Field orientation="horizontal" className="items-center justify-between py-2">
								<FieldLabel htmlFor="new-database-samples">Add sample notes</FieldLabel>
								<Switch id="new-database-samples" checked={samples} onCheckedChange={setSamples} />
							</Field>
						)}
						<Field>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="db-folders-toggle"
								aria-expanded={showFolders}
								onClick={() => setShowFolders((open) => !open)}
							>
								Or use notes you already have
								<ChevronRightIcon data-open={showFolders || undefined} />
							</Button>
							{showFolders && <FolderSuggestions onPick={(path) => void convert(path)} />}
							{showFolders && (
								<p className="db-folder-empty">
									Nothing moves: a small view note inside the folder holds the views.
								</p>
							)}
						</Field>
					</FieldGroup>
				</DialogBody>
				<DialogFooter className="dialog-chrome-footer">
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button type="submit" disabled={!parentPath || creating}>
						Create database
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	)
}
