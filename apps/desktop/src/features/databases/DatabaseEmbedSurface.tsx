import { useDatabaseStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import type {
	DatabaseBoardGroup,
	DatabaseLayout,
	DatabaseQueryResult,
	DatabaseRow,
	DatabaseViewDefinition,
} from "@cortex/databases"
import { DATABASE_MEMBERSHIP_PROPERTY_KEY } from "@cortex/databases"
import {
	createPropertyOption,
	getPropertyType,
	getVaultSchema,
	PROPERTY_COLORS,
	type PropertyColor,
	type PropertyDefinition,
	type PropertyOption,
	parsePropertyInput,
	resolvePropertyOption,
} from "@cortex/properties"
import {
	Button,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	NativeSelect,
	NativeSelectOption,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
	Columns3Icon,
	EyeOffIcon,
	GripVerticalIcon,
	LayoutPanelLeftIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCcwIcon,
	Table2Icon,
} from "lucide-react"
import {
	type ComponentProps,
	type DragEvent,
	type FocusEvent,
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { openDatabaseViewTab } from "./databaseWorkspace"

const rowHeight = 36
const databaseRowDragType = "application/x-cortex-database-row"
const defaultPropertyType = "text"
const propertyTypeChoices = [
	{ value: "text", label: "Text" },
	{ value: "number", label: "Number" },
	{ value: "select", label: "Select" },
	{ value: "date", label: "Date" },
	{ value: "checkbox", label: "Checkbox" },
	{ value: "url", label: "URL" },
	{ value: "email", label: "Email" },
	{ value: "phone", label: "Phone" },
] as const

const propertyColorLabels: Record<PropertyColor, string> = {
	blue: "Blue",
	green: "Green",
	red: "Red",
	amber: "Amber",
	gray: "Gray",
	purple: "Purple",
	pink: "Pink",
	teal: "Teal",
}

interface DatabaseEmbedSurfaceProps {
	databaseId: string
	viewId: string
	hostFilePath?: string | null
	embedded?: boolean
	onViewChange?: (viewId: string) => void
}

interface DatabaseCellProps {
	row: DatabaseRow
	property: PropertyDefinition
	value: unknown
	onSetCell: (row: DatabaseRow, property: PropertyDefinition, value: unknown) => void
}

interface DatabaseTableProps {
	result: DatabaseQueryResult
	properties: PropertyDefinition[]
	onOpenRow: (row: DatabaseRow) => void
	onSetCell: (row: DatabaseRow, property: PropertyDefinition, value: unknown) => void
	onCreateNote: () => void
	onAddProperty: (name: string, type: string) => Promise<void>
	onMoveColumn: (propertyKey: string, direction: -1 | 1) => void
	onHideColumn: (propertyKey: string) => void
}

interface DatabaseBoardProps {
	result: DatabaseQueryResult
	cardProperties: PropertyDefinition[]
	groupProperty: PropertyDefinition | null
	onOpenRow: (row: DatabaseRow) => void
	onMoveCard: (row: DatabaseRow, optionId: string | null) => void
	onCreateNote: (optionId: string | null) => void
	onRenameOption: (optionId: string, label: string) => void
	onColorOption: (optionId: string, color: PropertyColor) => void
	onAddOption: () => void
}

function getRelativePath(vaultPath: string, filePath: string): string {
	return filePath.startsWith(`${vaultPath}/`) ? filePath.slice(vaultPath.length + 1) : filePath
}

function getDefaultFolder(vaultPath: string, hostFilePath: string | null | undefined): string {
	if (!hostFilePath || !hostFilePath.startsWith(`${vaultPath}/`)) return ""
	const relativePath = getRelativePath(vaultPath, hostFilePath)
	return relativePath.includes("/") ? relativePath.split("/").slice(0, -1).join("/") : ""
}

function getVisibleProperties(
	view: DatabaseViewDefinition,
	databasePropertyKeys: readonly string[],
	schemaProperties: readonly PropertyDefinition[],
): PropertyDefinition[] {
	const propertiesByKey = new Map(schemaProperties.map((property) => [property.key, property]))
	const keys = view.visiblePropertyKeys.length > 0 ? view.visiblePropertyKeys : databasePropertyKeys
	return keys.flatMap((key) => {
		if (key === DATABASE_MEMBERSHIP_PROPERTY_KEY) return []
		const property = propertiesByKey.get(key)
		return property ? [property] : []
	})
}

function getNextColumnKeys(
	view: DatabaseViewDefinition,
	databasePropertyKeys: readonly string[],
): string[] {
	return view.visiblePropertyKeys.length > 0 ? view.visiblePropertyKeys : [...databasePropertyKeys]
}

function getDraggedDatabaseRow(event: DragEvent<HTMLElement>): DatabaseRow | null {
	try {
		const row = JSON.parse(
			event.dataTransfer.getData(databaseRowDragType) || "null",
		) as DatabaseRow | null
		return row && typeof row.relativePath === "string" ? row : null
	} catch {
		return null
	}
}

function getRowOptionId(row: DatabaseRow, propertyKey: string): string | null {
	const value = row.properties[propertyKey]
	return typeof value === "string" && value.length > 0 ? value : null
}

function DatabaseIcon({ layout }: { layout: DatabaseLayout }) {
	return layout === "board" ? (
		<Columns3Icon className="size-3.5" aria-hidden="true" />
	) : (
		<Table2Icon className="size-3.5" aria-hidden="true" />
	)
}

function ToolbarIconButton({
	label,
	children,
	...props
}: ComponentProps<typeof Button> & { label: string }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="ghost" size="icon-xs" aria-label={label} {...props}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	)
}

function SelectChip({ option }: { option: PropertyOption }) {
	return (
		<span className="note-property-option-value h-6 max-w-full" data-color={option.color}>
			<span className="note-property-color-dot" data-color={option.color} />
			<span>{option.label}</span>
		</span>
	)
}

function renderPropertyValue(property: PropertyDefinition, value: unknown): ReactNode {
	const propertyType = getPropertyType(property.type)
	if (propertyType?.baseType === "select" && typeof value === "string") {
		return <SelectChip option={resolvePropertyOption(property, value)} />
	}
	if (propertyType?.baseType === "checkbox") {
		return value === true ? "Checked" : "Unchecked"
	}
	if (value === null || value === undefined || value === "") return "No value"
	return String(value)
}

function DatabaseCell({ row, property, value, onSetCell }: DatabaseCellProps) {
	const propertyType = getPropertyType(property.type)
	if (!propertyType || propertyType.readOnly) {
		return <span className="truncate text-text-muted">{String(value ?? "")}</span>
	}
	if (propertyType.baseType === "select") {
		return (
			<NativeSelect
				size="sm"
				className="h-7 min-w-[132px] rounded-[7px]"
				value={typeof value === "string" ? value : ""}
				onChange={(event) => onSetCell(row, property, event.currentTarget.value || null)}
			>
				<NativeSelectOption value="">No value</NativeSelectOption>
				{(property.options ?? []).map((option) => (
					<NativeSelectOption key={option.id} value={option.id}>
						{option.label}
					</NativeSelectOption>
				))}
			</NativeSelect>
		)
	}
	if (propertyType.baseType === "checkbox") {
		return (
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label={property.name}
				onClick={() => onSetCell(row, property, value !== true)}
			>
				<Checkbox checked={value === true} aria-hidden="true" />
			</Button>
		)
	}
	return (
		<Input
			key={`${row.relativePath}:${property.key}:${String(value ?? "")}`}
			size="sm"
			type={propertyType.baseType === "date" ? "date" : undefined}
			defaultValue={String(value ?? "")}
			className="h-7 min-w-[132px] rounded-[7px] border-transparent bg-transparent px-2 shadow-none hover:bg-bg-tertiary focus-visible:bg-bg-primary"
			onBlur={(event) => {
				const nextRawValue = event.currentTarget.value
				if (nextRawValue === String(value ?? "")) return
				onSetCell(row, property, parsePropertyInput(propertyType.baseType, nextRawValue))
			}}
		/>
	)
}

function AddPropertyPopover({
	onAddProperty,
}: {
	onAddProperty: (name: string, type: string) => Promise<void>
}) {
	const [open, setOpen] = useState(false)
	const [propertyType, setPropertyType] = useState(defaultPropertyType)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const form = event.currentTarget
		const formData = new FormData(form)
		const name = String(formData.get("name") ?? "").trim()
		if (!name) return
		try {
			await onAddProperty(name, propertyType)
			form.reset()
			setPropertyType(defaultPropertyType)
			setError(null)
			setOpen(false)
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error))
		}
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button type="button" variant="ghost" size="icon-xs" aria-label="Add column">
					<PlusIcon className="size-3.5" aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 p-2">
				<form className="grid gap-2" onSubmit={handleSubmit}>
					<Input name="name" size="sm" placeholder="Column name" autoFocus />
					<NativeSelect
						size="sm"
						value={propertyType}
						onChange={(event) => setPropertyType(event.currentTarget.value)}
					>
						{propertyTypeChoices.map((choice) => (
							<NativeSelectOption key={choice.value} value={choice.value}>
								{choice.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
					{error && <output className="text-xs text-status-error">{error}</output>}
					<Button type="submit" size="sm" className="justify-center">
						Add column
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	)
}

function DatabaseColumnMenu({
	property,
	isFirst,
	isLast,
	onMoveColumn,
	onHideColumn,
}: {
	property: PropertyDefinition
	isFirst: boolean
	isLast: boolean
	onMoveColumn: (propertyKey: string, direction: -1 | 1) => void
	onHideColumn: (propertyKey: string) => void
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="icon-xs" aria-label={`${property.name} menu`}>
					<MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40">
				<DropdownMenuItem disabled={isFirst} onSelect={() => onMoveColumn(property.key, -1)}>
					Move left
				</DropdownMenuItem>
				<DropdownMenuItem disabled={isLast} onSelect={() => onMoveColumn(property.key, 1)}>
					Move right
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => onHideColumn(property.key)}>
					<EyeOffIcon className="size-3.5" aria-hidden="true" />
					Hide column
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function DatabaseTableView({
	result,
	properties,
	onOpenRow,
	onSetCell,
	onCreateNote,
	onAddProperty,
	onMoveColumn,
	onHideColumn,
}: DatabaseTableProps) {
	const scrollParentRef = useRef<HTMLDivElement | null>(null)
	const virtualizer = useVirtualizer({
		count: result.rows.length,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => rowHeight,
		overscan: 14,
	})
	const virtualRows = virtualizer.getVirtualItems()
	const beforeHeight = virtualRows[0]?.start ?? 0
	const afterHeight =
		virtualRows.length > 0 ? virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0) : 0
	const columnCount = properties.length + 2

	return (
		<div ref={scrollParentRef} className="database-embed-table-scroll min-h-0 overflow-auto">
			<Table className="database-embed-table min-w-[760px]">
				<TableHeader className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur">
					<TableRow>
						<TableHead className="database-table-name-heading w-[260px]">Name</TableHead>
						{properties.map((property, index) => (
							<TableHead key={property.key} className="min-w-[160px]">
								<div className="database-table-column-heading flex items-center justify-between gap-2">
									<span className="truncate">{property.name}</span>
									<DatabaseColumnMenu
										property={property}
										isFirst={index === 0}
										isLast={index === properties.length - 1}
										onMoveColumn={onMoveColumn}
										onHideColumn={onHideColumn}
									/>
								</div>
							</TableHead>
						))}
						<TableHead className="w-12 text-right">
							<AddPropertyPopover onAddProperty={onAddProperty} />
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{beforeHeight > 0 && (
						<TableRow aria-hidden="true">
							<TableCell colSpan={columnCount} style={{ height: beforeHeight, padding: 0 }} />
						</TableRow>
					)}
					{virtualRows.map((virtualRow) => {
						const row = result.rows[virtualRow.index]
						if (!row) return null
						return (
							<TableRow key={row.relativePath} style={{ height: virtualRow.size }}>
								<TableCell>
									<Button
										type="button"
										variant="ghost"
										className="database-table-name-button h-7 w-full justify-start truncate rounded-[7px] px-2"
										onClick={() => onOpenRow(row)}
									>
										{row.title}
									</Button>
								</TableCell>
								{properties.map((property) => (
									<TableCell key={`${row.relativePath}:${property.key}`} className="min-w-0">
										<DatabaseCell
											row={row}
											property={property}
											value={row.properties[property.key]}
											onSetCell={onSetCell}
										/>
									</TableCell>
								))}
								<TableCell />
							</TableRow>
						)
					})}
					{afterHeight > 0 && (
						<TableRow aria-hidden="true">
							<TableCell colSpan={columnCount} style={{ height: afterHeight, padding: 0 }} />
						</TableRow>
					)}
					<TableRow>
						<TableCell colSpan={columnCount}>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="database-table-add-note w-full justify-start text-text-muted"
								onClick={onCreateNote}
							>
								<PlusIcon className="size-3.5" aria-hidden="true" />
								New note
							</Button>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	)
}

function DatabaseBoardCard({
	row,
	cardProperties,
	isDragging,
	onOpenRow,
	onDragStart,
	onDragEnd,
}: {
	row: DatabaseRow
	cardProperties: PropertyDefinition[]
	isDragging: boolean
	onOpenRow: (row: DatabaseRow) => void
	onDragStart: (event: DragEvent<HTMLButtonElement>, row: DatabaseRow) => void
	onDragEnd: () => void
}) {
	const suppressClickRef = useRef(false)

	return (
		<li className="database-board-card-item">
			<button
				type="button"
				draggable
				className="database-board-card"
				data-dragging={isDragging ? "true" : undefined}
				onClick={() => {
					if (suppressClickRef.current) {
						suppressClickRef.current = false
						return
					}
					onOpenRow(row)
				}}
				onDragStart={(event) => {
					suppressClickRef.current = true
					onDragStart(event, row)
				}}
				onDragEnd={() => {
					onDragEnd()
					globalThis.setTimeout(() => {
						suppressClickRef.current = false
					}, 0)
				}}
			>
				<span className="database-board-card-topline">
					<GripVerticalIcon className="database-board-card-grip" aria-hidden="true" />
					<span className="database-board-card-title">{row.title}</span>
				</span>
				{cardProperties.length > 0 && (
					<span className="database-board-card-properties">
						{cardProperties.slice(0, 3).map((property) => (
							<span key={property.key} className="database-board-card-property">
								<span className="database-board-card-property-name">{property.name}</span>
								<span className="database-board-card-property-value">
									{renderPropertyValue(property, row.properties[property.key])}
								</span>
							</span>
						))}
					</span>
				)}
			</button>
		</li>
	)
}

function BoardColumnHeader({
	group,
	option,
	onRenameOption,
	onColorOption,
}: {
	group: DatabaseBoardGroup
	option: PropertyOption | null
	onRenameOption: (optionId: string, label: string) => void
	onColorOption: (optionId: string, color: PropertyColor) => void
}) {
	if (!group.optionId || !option) {
		return (
			<div className="flex min-w-0 items-center gap-2">
				<span className="truncate text-xs font-medium text-text-secondary">{group.label}</span>
			</div>
		)
	}
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			<span className="note-property-color-dot" data-color={option.color} aria-hidden="true" />
			<Input
				key={`${option.id}:${option.label}`}
				size="sm"
				defaultValue={option.label}
				className="h-7 min-w-0 flex-1 rounded-[7px] border-transparent bg-transparent px-1 font-medium shadow-none hover:bg-bg-tertiary focus-visible:bg-bg-primary"
				onBlur={(event) => {
					const label = event.currentTarget.value.trim()
					if (label && label !== option.label) onRenameOption(option.id, label)
					else event.currentTarget.value = option.label
				}}
			/>
			<NativeSelect
				size="sm"
				className="h-7 w-[92px] rounded-[7px]"
				value={option.color}
				aria-label={`Color for ${option.label}`}
				onChange={(event) => onColorOption(option.id, event.currentTarget.value as PropertyColor)}
			>
				{PROPERTY_COLORS.map((color) => (
					<NativeSelectOption key={color} value={color}>
						{propertyColorLabels[color]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</div>
	)
}

function DatabaseBoardColumn({
	group,
	groupProperty,
	cardProperties,
	draggingRow,
	isDragOver,
	onOpenRow,
	onCreateNote,
	onCardDragStart,
	onCardDragEnd,
	onColumnDragEnter,
	onColumnDragLeave,
	onDropRow,
	onRenameOption,
	onColorOption,
}: {
	group: DatabaseBoardGroup
	groupProperty: PropertyDefinition | null
	cardProperties: PropertyDefinition[]
	draggingRow: DatabaseRow | null
	isDragOver: boolean
	onOpenRow: (row: DatabaseRow) => void
	onCreateNote: (optionId: string | null) => void
	onCardDragStart: (event: DragEvent<HTMLButtonElement>, row: DatabaseRow) => void
	onCardDragEnd: () => void
	onColumnDragEnter: (groupId: string) => void
	onColumnDragLeave: (groupId: string) => void
	onDropRow: (event: DragEvent<HTMLElement>, optionId: string | null) => void
	onRenameOption: (optionId: string, label: string) => void
	onColorOption: (optionId: string, color: PropertyColor) => void
}) {
	const option =
		group.optionId && groupProperty
			? ((groupProperty.options ?? []).find((candidate) => candidate.id === group.optionId) ?? null)
			: null
	const handleDragOver = (event: DragEvent<HTMLElement>) => {
		event.preventDefault()
		event.dataTransfer.dropEffect = "move"
	}
	const handleDragEnter = (event: DragEvent<HTMLElement>) => {
		event.preventDefault()
		onColumnDragEnter(group.id)
	}
	const handleDragLeave = (event: DragEvent<HTMLElement>) => {
		const nextTarget = event.relatedTarget
		if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
		onColumnDragLeave(group.id)
	}
	const handleDrop = (event: DragEvent<HTMLElement>) => {
		event.preventDefault()
		event.stopPropagation()
		onDropRow(event, group.optionId)
	}

	return (
		<section
			aria-label={`${group.label} database lane`}
			className="database-board-lane"
			data-drag-over={isDragOver ? "true" : undefined}
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<header className="database-board-lane-header">
				<BoardColumnHeader
					group={group}
					option={option}
					onRenameOption={onRenameOption}
					onColorOption={onColorOption}
				/>
				<span className="database-board-lane-count">{group.rows.length}</span>
			</header>
			<ul className="database-board-list" aria-label={group.label}>
				{group.rows.map((row) => (
					<DatabaseBoardCard
						key={row.relativePath}
						row={row}
						cardProperties={cardProperties}
						isDragging={draggingRow?.relativePath === row.relativePath}
						onOpenRow={onOpenRow}
						onDragStart={onCardDragStart}
						onDragEnd={onCardDragEnd}
					/>
				))}
				<li>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="database-board-add-note h-9 w-full justify-start rounded-[8px] text-text-muted"
						onClick={() => onCreateNote(group.optionId)}
					>
						<PlusIcon className="size-3.5" aria-hidden="true" />
						New note
					</Button>
				</li>
			</ul>
		</section>
	)
}

function DatabaseBoardView({
	result,
	cardProperties,
	groupProperty,
	onOpenRow,
	onMoveCard,
	onCreateNote,
	onRenameOption,
	onColorOption,
	onAddOption,
}: DatabaseBoardProps) {
	const [draggingRow, setDraggingRow] = useState<DatabaseRow | null>(null)
	const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

	const handleCardDragStart = useCallback(
		(event: DragEvent<HTMLButtonElement>, row: DatabaseRow) => {
			event.dataTransfer.effectAllowed = "move"
			event.dataTransfer.setData(databaseRowDragType, JSON.stringify(row))
			event.dataTransfer.setData("text/plain", row.relativePath)
			setDraggingRow(row)
		},
		[],
	)
	const handleCardDragEnd = useCallback(() => {
		setDraggingRow(null)
		setDragOverGroupId(null)
	}, [])
	const handleColumnDragEnter = useCallback((groupId: string) => {
		setDragOverGroupId(groupId)
	}, [])
	const handleColumnDragLeave = useCallback((groupId: string) => {
		setDragOverGroupId((currentGroupId) => (currentGroupId === groupId ? null : currentGroupId))
	}, [])
	const handleDropRow = useCallback(
		(event: DragEvent<HTMLElement>, optionId: string | null) => {
			const row = draggingRow ?? getDraggedDatabaseRow(event)
			if (row && (!groupProperty || getRowOptionId(row, groupProperty.key) !== optionId)) {
				onMoveCard(row, optionId)
			}
			handleCardDragEnd()
		},
		[draggingRow, groupProperty, onMoveCard, handleCardDragEnd],
	)

	return (
		<div className="database-board-viewport min-h-0 overflow-auto">
			<div className="database-board-track flex min-w-max gap-3 pb-1">
				{result.boardGroups.map((group) => (
					<DatabaseBoardColumn
						key={group.id}
						group={group}
						groupProperty={groupProperty}
						cardProperties={cardProperties}
						draggingRow={draggingRow}
						isDragOver={dragOverGroupId === group.id}
						onOpenRow={onOpenRow}
						onCreateNote={onCreateNote}
						onCardDragStart={handleCardDragStart}
						onCardDragEnd={handleCardDragEnd}
						onColumnDragEnter={handleColumnDragEnter}
						onColumnDragLeave={handleColumnDragLeave}
						onDropRow={handleDropRow}
						onRenameOption={onRenameOption}
						onColorOption={onColorOption}
					/>
				))}
				{groupProperty && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="database-board-add-column h-10 w-[180px] justify-start rounded-[8px] text-text-muted"
						onClick={onAddOption}
					>
						<PlusIcon className="size-3.5" aria-hidden="true" />
						New column
					</Button>
				)}
			</div>
		</div>
	)
}

function DatabaseSurfaceSkeleton({ embedded }: { embedded: boolean }) {
	return (
		<div className={embedded ? "rounded-[8px] py-3" : "h-full p-4"}>
			<div className="flex items-center justify-between gap-3">
				<Skeleton className="h-7 w-44" />
				<Skeleton className="h-7 w-24" />
			</div>
			<div className="mt-3 grid gap-2">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-2/3" />
			</div>
		</div>
	)
}

export function DatabaseEmbedSurface({
	databaseId,
	viewId,
	hostFilePath,
	embedded = true,
	onViewChange,
}: DatabaseEmbedSurfaceProps) {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const createFile = useVaultStore((state) => state.createFile)
	const catalog = useDatabaseStore((state) => state.catalog)
	const loadedVaultPath = useDatabaseStore((state) => state.loadedVaultPath)
	const databaseIndex = useDatabaseStore((state) => state.index)
	const indexing = useDatabaseStore((state) => state.indexing)
	const loadCatalog = useDatabaseStore((state) => state.loadCatalog)
	const buildIndexFromFiles = useDatabaseStore((state) => state.buildIndexFromFiles)
	const queryView = useDatabaseStore((state) => state.queryView)
	const updateDatabase = useDatabaseStore((state) => state.updateDatabase)
	const createView = useDatabaseStore((state) => state.createView)
	const updateView = useDatabaseStore((state) => state.updateView)
	const updateViewColumns = useDatabaseStore((state) => state.updateViewColumns)
	const addPropertyToDatabase = useDatabaseStore((state) => state.addPropertyToDatabase)
	const ensureBoardStatusProperty = useDatabaseStore((state) => state.ensureBoardStatusProperty)
	const updateSelectOption = useDatabaseStore((state) => state.updateSelectOption)
	const addSelectOption = useDatabaseStore((state) => state.addSelectOption)
	const linkNoteToDatabase = useDatabaseStore((state) => state.linkNoteToDatabase)
	const setCell = useDatabaseStore((state) => state.setCell)
	const moveBoardCard = useDatabaseStore((state) => state.moveBoardCard)
	const workspaceOpenTab = useWorkspaceStore((state) => state.openTab)
	const [activeViewId, setActiveViewId] = useState(viewId)
	const [result, setResult] = useState<DatabaseQueryResult | null>(null)
	const [schemaProperties, setSchemaProperties] = useState<PropertyDefinition[]>([])
	const [schemaRevision, setSchemaRevision] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const database = catalog.databases[databaseId] ?? null
	const activeView =
		catalog.views[activeViewId] ??
		catalog.views[viewId] ??
		(database ? catalog.views[database.defaultViewId] : null)
	const databaseViews = useMemo(
		() =>
			Object.values(catalog.views)
				.filter((view) => view.databaseId === databaseId)
				.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
		[catalog.views, databaseId],
	)

	useEffect(() => {
		setActiveViewId(viewId)
	}, [viewId])

	useEffect(() => {
		if (!vault || loadedVaultPath === vault.path) return
		void loadCatalog(vault.path).catch((error) => setError(String(error)))
	}, [vault, loadedVaultPath, loadCatalog])

	useEffect(() => {
		if (!vault || !database) return
		if (databaseIndex?.vaultPath === vault.path) return
		void buildIndexFromFiles(vault.path, files, false)
	}, [vault, files, database, databaseIndex, buildIndexFromFiles])

	useEffect(() => {
		const refreshVersion = schemaRevision
		void refreshVersion
		if (!vault) {
			setSchemaProperties([])
			return
		}
		let cancelled = false
		void getVaultSchema(vault.path)
			.then((schema) => {
				if (!cancelled) setSchemaProperties(schema.properties)
			})
			.catch((error) => {
				if (!cancelled) setError(String(error))
			})
		return () => {
			cancelled = true
		}
	}, [vault, schemaRevision])

	useEffect(() => {
		const refreshVersion = schemaRevision
		void refreshVersion
		if (!vault || !database || !activeView || !databaseIndex) {
			setResult(null)
			return
		}
		let cancelled = false
		void queryView(vault.path, database.id, activeView.id)
			.then((nextResult) => {
				if (!cancelled) setResult(nextResult)
			})
			.catch((error) => {
				if (!cancelled) setError(String(error))
			})
		return () => {
			cancelled = true
		}
	}, [vault, database, activeView, databaseIndex, queryView, schemaRevision])

	const visibleProperties = useMemo(() => {
		if (!database || !activeView) return []
		return getVisibleProperties(activeView, database.propertyKeys, schemaProperties)
	}, [database, activeView, schemaProperties])

	const groupProperty = useMemo(() => {
		if (!activeView?.groupByPropertyKey) return null
		return (
			schemaProperties.find((property) => property.key === activeView.groupByPropertyKey) ?? null
		)
	}, [activeView, schemaProperties])

	const handleRefreshSchema = useCallback(() => {
		setSchemaRevision((revision) => revision + 1)
	}, [])

	const handleSwitchView = useCallback(
		(nextViewId: string) => {
			setActiveViewId(nextViewId)
			onViewChange?.(nextViewId)
		},
		[onViewChange],
	)

	const handleRenameDatabase = useCallback(
		(event: FocusEvent<HTMLInputElement>) => {
			if (!vault || !database) return
			const nextName = event.currentTarget.value.trim() || database.name
			event.currentTarget.value = nextName
			if (nextName === database.name) return
			void updateDatabase(vault.path, database.id, { name: nextName }).catch((error) =>
				setError(String(error)),
			)
		},
		[vault, database, updateDatabase],
	)

	const handleOpenRow = useCallback(
		(row: DatabaseRow) => {
			workspaceOpenTab(row.filePath)
		},
		[workspaceOpenTab],
	)

	const handleSetCell = useCallback(
		(row: DatabaseRow, property: PropertyDefinition, value: unknown) => {
			if (!vault) return
			void setCell(vault.path, row.filePath, property.key, value).catch((error) =>
				setError(String(error)),
			)
		},
		[vault, setCell],
	)

	const handleMoveCard = useCallback(
		(row: DatabaseRow, optionId: string | null) => {
			if (!vault || !activeView?.groupByPropertyKey) return
			void moveBoardCard(vault.path, row.filePath, activeView.groupByPropertyKey, optionId).catch(
				(error) => setError(String(error)),
			)
		},
		[vault, activeView, moveBoardCard],
	)

	const handleCreateNote = useCallback(
		(optionId: string | null = null) => {
			if (!vault || !database || !activeView) return
			const folder = database.defaultFolder || getDefaultFolder(vault.path, hostFilePath)
			const parentPath = folder ? `${vault.path}/${folder}` : vault.path
			const defaults =
				activeView.groupByPropertyKey && optionId
					? { [activeView.groupByPropertyKey]: optionId }
					: {}
			void createFile(parentPath, "Untitled")
				.then(async (filePath) => {
					await linkNoteToDatabase(vault.path, filePath, database.id, defaults)
					workspaceOpenTab(filePath)
				})
				.catch((error) => setError(String(error)))
		},
		[vault, database, activeView, hostFilePath, createFile, linkNoteToDatabase, workspaceOpenTab],
	)

	const handleAddProperty = useCallback(
		async (name: string, type: string) => {
			if (!vault || !database || !activeView) return
			const options = type === "select" ? [createPropertyOption("Option")] : undefined
			await addPropertyToDatabase(vault.path, database.id, activeView.id, { name, type, options })
			handleRefreshSchema()
		},
		[vault, database, activeView, addPropertyToDatabase, handleRefreshSchema],
	)

	const handleMoveColumn = useCallback(
		(propertyKey: string, direction: -1 | 1) => {
			if (!vault || !database || !activeView) return
			const keys = getNextColumnKeys(activeView, database.propertyKeys)
			const from = keys.indexOf(propertyKey)
			const to = from + direction
			if (from < 0 || to < 0 || to >= keys.length) return
			const nextKeys = [...keys]
			const [moved] = nextKeys.splice(from, 1)
			nextKeys.splice(to, 0, moved)
			void updateViewColumns(vault.path, activeView.id, nextKeys).catch((error) =>
				setError(String(error)),
			)
		},
		[vault, database, activeView, updateViewColumns],
	)

	const handleHideColumn = useCallback(
		(propertyKey: string) => {
			if (!vault || !database || !activeView) return
			const nextKeys = getNextColumnKeys(activeView, database.propertyKeys).filter(
				(key) => key !== propertyKey,
			)
			void updateViewColumns(vault.path, activeView.id, nextKeys).catch((error) =>
				setError(String(error)),
			)
		},
		[vault, database, activeView, updateViewColumns],
	)

	const ensureBoardGrouping = useCallback(async (): Promise<PropertyDefinition | null> => {
		if (!vault || !database) return null
		const statusProperty = await ensureBoardStatusProperty(vault.path)
		if (!database.propertyKeys.includes(statusProperty.key)) {
			await updateDatabase(vault.path, database.id, {
				propertyKeys: [...database.propertyKeys, statusProperty.key],
			})
		}
		handleRefreshSchema()
		return statusProperty
	}, [vault, database, ensureBoardStatusProperty, updateDatabase, handleRefreshSchema])

	const handleCreateView = useCallback(
		(layout: DatabaseLayout) => {
			if (!vault || !database || !activeView) return
			void (async () => {
				const statusProperty = layout === "board" ? await ensureBoardGrouping() : null
				const visiblePropertyKeys = Array.from(
					new Set([
						...getNextColumnKeys(activeView, database.propertyKeys),
						...(statusProperty ? [statusProperty.key] : []),
					]),
				)
				const view = await createView(vault.path, {
					databaseId: database.id,
					name: layout === "board" ? "Board" : "Table",
					layout,
					visiblePropertyKeys,
					groupByPropertyKey: statusProperty?.key,
				})
				handleSwitchView(view.id)
			})().catch((error) => setError(String(error)))
		},
		[vault, database, activeView, createView, ensureBoardGrouping, handleSwitchView],
	)

	const handleSetLayout = useCallback(
		(layout: DatabaseLayout) => {
			if (!vault || !database || !activeView || activeView.layout === layout) return
			void (async () => {
				const statusProperty = layout === "board" ? await ensureBoardGrouping() : null
				await updateView(vault.path, activeView.id, {
					layout,
					groupByPropertyKey: layout === "board" ? statusProperty?.key : undefined,
					visiblePropertyKeys: Array.from(
						new Set([
							...getNextColumnKeys(activeView, database.propertyKeys),
							...(statusProperty ? [statusProperty.key] : []),
						]),
					),
				})
			})().catch((error) => setError(String(error)))
		},
		[vault, database, activeView, ensureBoardGrouping, updateView],
	)

	const handleRenameOption = useCallback(
		(optionId: string, label: string) => {
			if (!vault || !groupProperty) return
			void updateSelectOption(vault.path, groupProperty.key, optionId, { label })
				.then(handleRefreshSchema)
				.catch((error) => setError(String(error)))
		},
		[vault, groupProperty, updateSelectOption, handleRefreshSchema],
	)

	const handleColorOption = useCallback(
		(optionId: string, color: PropertyColor) => {
			if (!vault || !groupProperty) return
			void updateSelectOption(vault.path, groupProperty.key, optionId, { color })
				.then(handleRefreshSchema)
				.catch((error) => setError(String(error)))
		},
		[vault, groupProperty, updateSelectOption, handleRefreshSchema],
	)

	const handleAddOption = useCallback(() => {
		if (!vault || !groupProperty) return
		void addSelectOption(vault.path, groupProperty.key, "New column")
			.then(handleRefreshSchema)
			.catch((error) => setError(String(error)))
	}, [vault, groupProperty, addSelectOption, handleRefreshSchema])

	if (!vault || !database || !activeView) {
		return <DatabaseSurfaceSkeleton embedded={embedded} />
	}

	const cardProperties =
		activeView.layout === "board"
			? visibleProperties.filter((property) => property.key !== activeView.groupByPropertyKey)
			: visibleProperties

	return (
		<TooltipProvider delayDuration={350}>
			<section
				className={
					embedded
						? "database-embed-surface my-4 flex min-h-0 w-full flex-col gap-2 rounded-[8px] bg-bg-primary py-2"
						: "database-embed-surface flex h-full min-h-0 flex-col gap-2 bg-bg-primary p-3"
				}
				data-database-id={database.id}
			>
				<header className="flex min-w-0 flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-[220px] flex-1 items-center gap-2">
						<Input
							key={database.name}
							size="sm"
							defaultValue={database.name}
							className="h-8 max-w-[320px] border-transparent bg-transparent px-1 text-base font-semibold shadow-none hover:bg-bg-tertiary focus-visible:bg-bg-primary"
							onBlur={handleRenameDatabase}
						/>
						<span className="text-xs tabular-nums text-text-muted">{result?.rows.length ?? 0}</span>
					</div>
					<div className="flex items-center gap-1">
						<ToolbarIconButton
							label="Refresh"
							onClick={() => void buildIndexFromFiles(vault.path, files, true)}
						>
							<RefreshCcwIcon className="size-3.5" aria-hidden="true" />
						</ToolbarIconButton>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="ghost" size="icon-xs" aria-label="View options">
									<MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-44">
								<DropdownMenuItem onSelect={() => handleSetLayout("table")}>
									<Table2Icon className="size-3.5" aria-hidden="true" />
									Table layout
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => handleSetLayout("board")}>
									<Columns3Icon className="size-3.5" aria-hidden="true" />
									Board layout
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => openDatabaseViewTab(database.id, activeView.id)}>
									<LayoutPanelLeftIcon className="size-3.5" aria-hidden="true" />
									Open in tab
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
					<Tabs value={activeView.id} onValueChange={handleSwitchView} className="min-w-0">
						<TabsList variant="line" className="h-8 max-w-full overflow-x-auto">
							{databaseViews.map((view) => (
								<TabsTrigger key={view.id} value={view.id} className="max-w-[180px] px-2">
									<DatabaseIcon layout={view.layout} />
									<span className="truncate">{view.name}</span>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="ghost" size="sm" className="h-7">
								<PlusIcon className="size-3.5" aria-hidden="true" />
								View
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-36">
							<DropdownMenuItem onSelect={() => handleCreateView("table")}>
								<Table2Icon className="size-3.5" aria-hidden="true" />
								Table
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => handleCreateView("board")}>
								<Columns3Icon className="size-3.5" aria-hidden="true" />
								Board
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				{error && <output className="text-xs text-status-error">{error}</output>}
				{indexing && !result ? (
					<DatabaseSurfaceSkeleton embedded={embedded} />
				) : result?.view.layout === "board" ? (
					<DatabaseBoardView
						result={result}
						cardProperties={cardProperties}
						groupProperty={groupProperty}
						onOpenRow={handleOpenRow}
						onMoveCard={handleMoveCard}
						onCreateNote={handleCreateNote}
						onRenameOption={handleRenameOption}
						onColorOption={handleColorOption}
						onAddOption={handleAddOption}
					/>
				) : result ? (
					<DatabaseTableView
						result={result}
						properties={visibleProperties}
						onOpenRow={handleOpenRow}
						onSetCell={handleSetCell}
						onCreateNote={() => handleCreateNote(null)}
						onAddProperty={handleAddProperty}
						onMoveColumn={handleMoveColumn}
						onHideColumn={handleHideColumn}
					/>
				) : (
					<div className="flex min-h-[132px] items-center justify-center rounded-[8px] bg-bg-secondary/50 text-sm text-text-muted">
						No notes yet
					</div>
				)}
			</section>
		</TooltipProvider>
	)
}
