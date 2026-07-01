import { useDatabaseStore, useEditorStore, useVaultStore } from "@cortex/core"
import type { DatabaseLayout } from "@cortex/databases"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	NativeSelect,
	NativeSelectOption,
} from "@cortex/ui"
import { Columns3Icon, Table2Icon } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import {
	createInlineDatabaseAtActiveSelection,
	insertDatabaseEmbedAtActiveSelection,
} from "./databaseCommands"
import {
	closeDatabaseDialog,
	type DatabaseDialogMode,
	useDatabaseDialogMode,
} from "./databaseDialogStore"
import {
	getActiveDatabaseViewState,
	isDatabaseViewTabState,
	openDatabaseViewTab,
} from "./databaseWorkspace"

const layoutLabels: Record<DatabaseLayout, string> = {
	table: "Table",
	board: "Board",
}

function getInitialName(layout: DatabaseLayout): string {
	return layout === "board" ? "Board" : "Database"
}

function CreateDatabaseForm() {
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [layout, setLayout] = useState<DatabaseLayout>("table")
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setLayout("table")
		setError(null)
	}, [])

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		const name = String(formData.get("name") ?? "").trim() || getInitialName(layout)
		try {
			const created = await createInlineDatabaseAtActiveSelection(activeFilePath, { name, layout })
			if (!created) throw new Error("Open a note before creating an inline database.")
			closeDatabaseDialog()
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error))
		}
	}

	return (
		<form className="flex min-h-0 flex-col gap-4" onSubmit={handleSubmit}>
			<DialogBody className="grid gap-3">
				<Input name="name" placeholder="Database name" defaultValue={getInitialName(layout)} />
				<div className="flex flex-wrap gap-2">
					<NativeSelect
						value={layout}
						onChange={(event) => setLayout(event.currentTarget.value as DatabaseLayout)}
					>
						<NativeSelectOption value="table">Table</NativeSelectOption>
						<NativeSelectOption value="board">Board</NativeSelectOption>
					</NativeSelect>
				</div>
				{error && <output className="text-xs text-status-error">{error}</output>}
			</DialogBody>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={closeDatabaseDialog}>
					Cancel
				</Button>
				<Button type="submit">Create</Button>
			</DialogFooter>
		</form>
	)
}

function OpenDatabasePicker({ embed }: { embed: boolean }) {
	const catalog = useDatabaseStore((state) => state.catalog)
	const items = useMemo(
		() =>
			Object.values(catalog.views).flatMap((view) => {
				const database = catalog.databases[view.databaseId]
				return database ? [{ database, view }] : []
			}),
		[catalog],
	)

	return (
		<Command data-command-surface className="overflow-hidden rounded-none border-0 bg-transparent">
			<CommandInput placeholder={embed ? "Embed database view" : "Open database view"} />
			<CommandList className="max-h-[320px]">
				<CommandEmpty>No database views</CommandEmpty>
				<CommandGroup heading="Views">
					{items.map(({ database, view }) => (
						<CommandItem
							key={view.id}
							value={`${database.name} ${view.name}`}
							onSelect={() => {
								if (embed) insertDatabaseEmbedAtActiveSelection(database.id, view.id)
								else openDatabaseViewTab(database.id, view.id)
								closeDatabaseDialog()
							}}
						>
							{view.layout === "board" ? (
								<Columns3Icon className="size-4" aria-hidden="true" />
							) : (
								<Table2Icon className="size-4" aria-hidden="true" />
							)}
							<span>{database.name}</span>
							<span className="text-text-muted">{view.name}</span>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</Command>
	)
}

function CreateDatabaseViewForm() {
	const vault = useVaultStore((state) => state.vault)
	const createView = useDatabaseStore((state) => state.createView)
	const catalog = useDatabaseStore((state) => state.catalog)
	const [layout, setLayout] = useState<DatabaseLayout>("table")
	const [error, setError] = useState<string | null>(null)
	const target = getActiveDatabaseViewState()
	const database = target ? catalog.databases[target.databaseId] : null
	const activeView = target ? catalog.views[target.viewId] : null

	useEffect(() => {
		setLayout("table")
		setError(null)
	}, [])

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!vault || !database || !activeView) return
		const formData = new FormData(event.currentTarget)
		const name = String(formData.get("name") ?? "").trim() || layoutLabels[layout]
		try {
			const view = await createView(vault.path, {
				databaseId: database.id,
				name,
				layout,
				groupByPropertyKey: layout === "board" ? activeView.groupByPropertyKey : undefined,
				visiblePropertyKeys: activeView.visiblePropertyKeys,
			})
			openDatabaseViewTab(database.id, view.id)
			closeDatabaseDialog()
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error))
		}
	}

	if (!database || !isDatabaseViewTabState(target)) {
		return (
			<DialogBody className="grid gap-4">
				<p className="text-sm text-text-muted">Open a database view first.</p>
				<Button type="button" variant="outline" onClick={closeDatabaseDialog}>
					Close
				</Button>
			</DialogBody>
		)
	}

	return (
		<form className="flex min-h-0 flex-col gap-4" onSubmit={handleSubmit}>
			<DialogBody className="grid gap-3">
				<Input name="name" placeholder="View name" defaultValue={layoutLabels[layout]} />
				<NativeSelect
					value={layout}
					onChange={(event) => setLayout(event.currentTarget.value as DatabaseLayout)}
				>
					<NativeSelectOption value="table">Table</NativeSelectOption>
					<NativeSelectOption value="board">Board</NativeSelectOption>
				</NativeSelect>
				{error && <output className="text-xs text-status-error">{error}</output>}
			</DialogBody>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={closeDatabaseDialog}>
					Cancel
				</Button>
				<Button type="submit">Create</Button>
			</DialogFooter>
		</form>
	)
}

function getDialogTitle(mode: DatabaseDialogMode): string {
	if (mode === "create") return "New Database"
	if (mode === "create-view") return "New View"
	if (mode === "embed") return "Embed Database"
	return "Open Database"
}

export function DatabaseDialogHost() {
	const mode = useDatabaseDialogMode()
	const handleOpenChange = (open: boolean) => {
		if (!open) closeDatabaseDialog()
	}

	return (
		<Dialog open={mode !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="flex max-h-[min(560px,calc(100vh-2rem))] flex-col gap-4 overflow-hidden p-0 sm:max-w-[520px]">
				<DialogHeader className="dialog-chrome-header shrink-0">
					<DialogTitle>{mode ? getDialogTitle(mode) : "Database"}</DialogTitle>
				</DialogHeader>
				{mode === "create" && <CreateDatabaseForm />}
				{mode === "open" && <OpenDatabasePicker embed={false} />}
				{mode === "embed" && <OpenDatabasePicker embed={true} />}
				{mode === "create-view" && <CreateDatabaseViewForm />}
			</DialogContent>
		</Dialog>
	)
}
