import {
	convertFolderToDatabase,
	removeDatabaseRowTemplate,
	saveDatabaseRowTemplate,
	useCanWriteVaultPath,
	useWorkspaceStore,
} from "@cortex/core"
import {
	type DatabaseQueryResult,
	type DatabaseView as DatabaseViewConfig,
	getDatabaseAccentKey,
} from "@cortex/properties/database"
import {
	Button,
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
	Spinner,
} from "@cortex/ui"
import { useCallback, useRef, useState } from "react"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { DatabaseBoardView, getBoardGroupKey } from "./DatabaseBoardView"
import { DatabaseCalendarView } from "./DatabaseCalendarView"
import { DatabaseFilterBar } from "./DatabaseFilterBar"
import { DatabaseGalleryView } from "./DatabaseGalleryView"
import { DatabaseHeader } from "./DatabaseHeader"
import { DatabasePeek } from "./DatabasePeek"
import { DatabaseTableView } from "./DatabaseTableView"
import { DatabaseToolbar } from "./DatabaseToolbar"
import { type DatabaseViewState, readDatabaseViewState } from "./databaseWorkspace"
import {
	type DatabaseController,
	type PatchDatabaseViewState,
	useDatabaseController,
} from "./useDatabaseController"
import "./database.css"

function DatabaseLoading() {
	return (
		<div className="db-loading">
			<Spinner />
		</div>
	)
}

function NotADatabase({ folderPath }: { folderPath: string }) {
	return (
		<Empty className="db-empty">
			<EmptyHeader>
				<EmptyTitle>This folder is not a database</EmptyTitle>
				<EmptyDescription>
					Turn it into a database to see its notes as a table. Nothing is moved.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => void convertFolderToDatabase(folderPath)}
				>
					Turn into database
				</Button>
			</EmptyContent>
		</Empty>
	)
}

interface DatabasePaneProps {
	controller: DatabaseController
	view: DatabaseViewConfig
	result: DatabaseQueryResult
	state: DatabaseViewState
	patchState: PatchDatabaseViewState
}

function DatabaseBody({
	controller,
	view,
	result,
	state,
	patchState,
	readOnly,
}: DatabasePaneProps & { readOnly: boolean }) {
	const selectRow = useCallback((path: string) => patchState({ peekPath: path }), [patchState])
	if (controller.rowsStatus === "loading" && result.totalCount === 0) return <DatabaseLoading />
	const shared = {
		folderPath: controller.folderPath,
		rows: result.rows,
		resolved: controller.resolved,
		columns: controller.columns,
		selectedPath: state.peekPath,
		authorConfig: controller.environment.authorConfig,
		today: controller.environment.queryContext.today,
		readOnly,
		onSelect: selectRow,
	}
	if (view.type === "board") {
		return (
			<DatabaseBoardView
				{...shared}
				groupKey={view.group}
				onCreate={(group) => {
					const key = getBoardGroupKey(view.group, controller.resolved)
					const extra = key && group.value !== undefined ? { [key]: group.value } : {}
					void controller.createRow(group, null, extra)
				}}
			/>
		)
	}
	if (view.type === "calendar") {
		return (
			<DatabaseCalendarView
				{...shared}
				dateKey={view.date}
				accentKey={getDatabaseAccentKey(view, controller.resolved)}
				onCreateOnDate={(key, date) => void controller.createRow(null, null, { [key]: date })}
			/>
		)
	}
	if (view.type === "gallery") {
		return <DatabaseGalleryView {...shared} coverKey={view.cover} />
	}
	return (
		<DatabaseTableView
			folderPath={controller.folderPath}
			groups={result.groups}
			grouped={Boolean(view.group)}
			columns={controller.columns}
			collapsed={controller.collapsed}
			selectedPath={state.peekPath}
			authorConfig={controller.environment.authorConfig}
			today={controller.environment.queryContext.today}
			sort={view.sort?.[0]}
			readOnly={readOnly}
			onSort={controller.cycleSort}
			onRename={readOnly ? undefined : controller.renameRow}
			onToggleGroup={controller.toggleGroup}
			onSelect={selectRow}
			onCreate={(group) => void controller.createRow(group)}
			onUpdateDefinition={controller.environment.updateDefinition}
			onReorder={
				readOnly || view.sort?.length
					? undefined
					: (dragged, target) => controller.reorderRows(result.rows, dragged, target)
			}
		/>
	)
}

function DatabasePeekPane({
	controller,
	result,
	state,
	patchState,
	container,
}: DatabasePaneProps & { container: HTMLElement | null }) {
	const peekRow = state.peekPath ? (controller.rowsRecord[state.peekPath] ?? null) : null
	if (!peekRow) return null
	const index = result.rows.findIndex((row) => row.path === peekRow.path)
	const move = (offset: number) => {
		const next = result.rows[index + offset]
		if (next) patchState({ peekPath: next.path })
	}
	return (
		<DatabasePeek
			row={peekRow}
			position={index + 1}
			count={result.rows.length}
			onPrevious={() => move(-1)}
			onNext={() => move(1)}
			onClose={() => patchState({ peekPath: null })}
			onSaveTemplate={(name) => saveDatabaseRowTemplate(controller.folderPath, peekRow.path, name)}
			onRename={(name) => controller.renameRow(peekRow.path, name)}
			databaseName={controller.entry?.name ?? ""}
			container={container}
		/>
	)
}

function DatabaseWorkspace(props: DatabasePaneProps & { readOnly: boolean }) {
	const { controller, view, result, state, patchState, readOnly } = props
	const entry = controller.entry
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [peekSlot, setPeekSlot] = useState<HTMLDivElement | null>(null)
	if (!entry) return null
	return (
		<div className="db-page">
			<div className="db-main">
				<DatabaseHeader
					name={entry.name}
					count={result.totalCount}
					templates={entry.config.templates ?? []}
					readOnly={readOnly}
					onCreate={(template) => void controller.createRow(null, template)}
					onRemoveTemplate={(templateId) =>
						removeDatabaseRowTemplate(controller.folderPath, templateId)
					}
					onRename={controller.renameDatabase}
				/>
				{entry.configError && (
					<p className="db-warning">
						Views need attention: {entry.configError}.
						<Button
							variant="link"
							size="xs"
							onClick={() => useWorkspaceStore.getState().openTab(entry.viewNotePath)}
						>
							Open settings note
						</Button>
					</p>
				)}
				<DatabaseToolbar
					views={entry.config.views}
					activeView={view}
					properties={controller.resolved.properties}
					columns={controller.columns}
					search={state.search}
					filtersOpen={filtersOpen}
					onSelectView={(id) => patchState({ viewId: id })}
					onAddView={controller.addView}
					onRemoveView={controller.removeView}
					onUpdateView={controller.updateView}
					onToggleFilters={() => setFiltersOpen((open) => !open)}
					onSearchChange={(search) => patchState({ search })}
				/>
				{(filtersOpen || Boolean(view.filters?.length)) && (
					<DatabaseFilterBar
						view={view}
						properties={controller.resolved.properties}
						onUpdateView={controller.updateView}
					/>
				)}
				<DatabaseBody {...props} />
				<footer className="db-status">
					{result.matchedCount} of {result.totalCount} notes
				</footer>
			</div>
			<div ref={setPeekSlot} className="db-peek-slot" />
			{peekSlot && <DatabasePeekPane {...props} container={peekSlot} />}
		</div>
	)
}

export function DatabaseView({ viewState, onStateChange }: CoreViewProps) {
	const state = readDatabaseViewState(viewState)
	const viewStateRef = useRef(viewState)
	viewStateRef.current = viewState
	const patchState = useCallback<PatchDatabaseViewState>(
		(patch) => onStateChange({ ...viewStateRef.current, ...patch }),
		[onStateChange],
	)
	const controller = useDatabaseController(state, patchState)
	const readOnly = !useCanWriteVaultPath(state.filePath)
	const { entry, activeView, result } = controller
	if (!entry || !activeView || !result) {
		return controller.registryReady ? (
			<NotADatabase folderPath={state.filePath} />
		) : (
			<DatabaseLoading />
		)
	}
	return (
		<DatabaseWorkspace
			controller={controller}
			view={activeView}
			result={result}
			state={state}
			patchState={patchState}
			readOnly={readOnly}
		/>
	)
}
