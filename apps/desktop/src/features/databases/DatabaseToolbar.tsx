import type { PropertyDefinition } from "@cortex/properties"
import {
	DATABASE_EDITED_KEY,
	DATABASE_TITLE_KEY,
	DATABASE_VIEW_TYPES,
	type DatabaseView,
	type DatabaseViewType,
	getPropertyBaseType,
} from "@cortex/properties/database"
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@cortex/ui"
import {
	ArrowDownUpIcon,
	CalendarIcon,
	FilterIcon,
	LayersIcon,
	LayoutGridIcon,
	type LucideIcon,
	PlusIcon,
	SearchIcon,
	SlidersHorizontalIcon,
	SquareKanbanIcon,
	Table2Icon,
	TrashIcon,
} from "lucide-react"

export const DATABASE_VIEW_ICONS: Record<DatabaseViewType, LucideIcon> = {
	table: Table2Icon,
	board: SquareKanbanIcon,
	calendar: CalendarIcon,
	gallery: LayoutGridIcon,
}

const GROUPABLE_TYPES = new Set(["select", "person", "checkbox", "text", "tags"])

interface DatabaseToolbarProps {
	views: DatabaseView[]
	activeView: DatabaseView
	properties: PropertyDefinition[]
	columns: PropertyDefinition[]
	search: string
	filtersOpen: boolean
	onSelectView: (id: string) => void
	onAddView: (type: DatabaseViewType) => void
	onRemoveView: (id: string) => void
	onUpdateView: (update: (view: DatabaseView) => DatabaseView) => void
	onToggleFilters: () => void
	onSearchChange: (search: string) => void
}

function SortMenu({
	view,
	properties,
	onUpdateView,
}: Pick<DatabaseToolbarProps, "properties" | "onUpdateView"> & { view: DatabaseView }) {
	const current = view.sort?.[0]
	const value = current ? `${current.key}|${current.dir}` : "none"
	const options = [
		{ key: DATABASE_TITLE_KEY, name: "Name" },
		{ key: DATABASE_EDITED_KEY, name: "Last edited" },
		...properties.map((definition) => ({ key: definition.key, name: definition.name })),
	]
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant="ghost"
					aria-label="Sort"
					data-active={current ? true : undefined}
					className="db-tool"
				>
					<ArrowDownUpIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="db-menu">
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(next) =>
						onUpdateView((target) => {
							if (next === "none") return { ...target, sort: undefined }
							const [key, dir] = next.split("|")
							return { ...target, sort: [{ key, dir: dir === "desc" ? "desc" : "asc" }] }
						})
					}
				>
					<DropdownMenuRadioItem value="none">Manual</DropdownMenuRadioItem>
					{options.flatMap((option) => [
						<DropdownMenuRadioItem key={`${option.key}|asc`} value={`${option.key}|asc`}>
							{option.name}, ascending
						</DropdownMenuRadioItem>,
						<DropdownMenuRadioItem key={`${option.key}|desc`} value={`${option.key}|desc`}>
							{option.name}, descending
						</DropdownMenuRadioItem>,
					])}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

interface LayoutOption {
	field: "group" | "date" | "cover"
	label: string
	emptyLabel: string | null
	accepts: (definition: PropertyDefinition) => boolean
}

const BOARD_LAYOUT: LayoutOption = {
	field: "group",
	label: "Group by",
	emptyLabel: null,
	accepts: (definition) => getPropertyBaseType(definition) === "select",
}

const LAYOUT_OPTIONS: Record<DatabaseViewType, LayoutOption> = {
	table: {
		field: "group",
		label: "Group by",
		emptyLabel: "No grouping",
		accepts: (definition) => GROUPABLE_TYPES.has(getPropertyBaseType(definition)),
	},
	board: BOARD_LAYOUT,
	calendar: {
		field: "date",
		label: "Show by date",
		emptyLabel: null,
		accepts: (definition) => getPropertyBaseType(definition) === "date",
	},
	gallery: {
		field: "cover",
		label: "Card cover",
		emptyLabel: "First image in the note",
		accepts: (definition) => {
			const baseType = getPropertyBaseType(definition)
			return baseType === "url" || baseType === "text"
		},
	},
}

function LayoutMenu({
	view,
	properties,
	onUpdateView,
}: Pick<DatabaseToolbarProps, "properties" | "onUpdateView"> & { view: DatabaseView }) {
	const layout = LAYOUT_OPTIONS[view.type]
	const candidates = properties.filter(layout.accepts)
	const current = view[layout.field]
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant="ghost"
					aria-label={layout.label}
					data-active={current ? true : undefined}
					className="db-tool"
				>
					<LayersIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="db-menu">
				<DropdownMenuLabel>{layout.label}</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={current ?? ""}
					onValueChange={(next) =>
						onUpdateView((target) => ({ ...target, [layout.field]: next || undefined }))
					}
				>
					{layout.emptyLabel && (
						<DropdownMenuRadioItem value="">{layout.emptyLabel}</DropdownMenuRadioItem>
					)}
					{candidates.map((definition) => (
						<DropdownMenuRadioItem key={definition.id} value={definition.key}>
							{definition.name}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				{candidates.length === 0 && (
					<DropdownMenuItem disabled>No matching properties yet</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function PropertiesMenu({
	view,
	properties,
	columns,
	onUpdateView,
}: Pick<DatabaseToolbarProps, "properties" | "columns" | "onUpdateView"> & {
	view: DatabaseView
}) {
	const visible = new Set(columns.map((definition) => definition.key))
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Properties" className="db-tool">
					<SlidersHorizontalIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="db-menu">
				<DropdownMenuLabel>Shown in {view.name.toLocaleLowerCase()}</DropdownMenuLabel>
				{properties.map((definition) => (
					<DropdownMenuCheckboxItem
						key={definition.id}
						checked={visible.has(definition.key)}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={(checked) =>
							onUpdateView((target) => {
								const current = new Set(target.columns ?? properties.map((item) => item.key))
								if (checked) current.add(definition.key)
								else current.delete(definition.key)
								const next = properties.map((item) => item.key).filter((key) => current.has(key))
								return { ...target, columns: next }
							})
						}
					>
						{definition.name}
					</DropdownMenuCheckboxItem>
				))}
				{properties.length === 0 && (
					<DropdownMenuItem disabled>Add a property to a note to see it here</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function DatabaseToolbar({
	views,
	activeView,
	properties,
	columns,
	search,
	filtersOpen,
	onSelectView,
	onAddView,
	onRemoveView,
	onUpdateView,
	onToggleFilters,
	onSearchChange,
}: DatabaseToolbarProps) {
	const filterCount = activeView.filters?.length ?? 0
	return (
		<div className="db-bar">
			<div className="db-views" role="tablist" aria-label="Views">
				{views.map((view) => {
					const Icon = DATABASE_VIEW_ICONS[view.type]
					return (
						<Button
							size="sm"
							key={view.id}
							variant="ghost"
							role="tab"
							aria-selected={view.id === activeView.id}
							className="db-view-tab"
							onClick={() => onSelectView(view.id)}
						>
							<Icon />
							{view.name}
						</Button>
					)
				})}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button size="sm" variant="ghost" className="db-view-tab db-view-add">
							<PlusIcon />
							View
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="db-menu">
						{DATABASE_VIEW_TYPES.map((type) => {
							const Icon = DATABASE_VIEW_ICONS[type]
							return (
								<DropdownMenuItem key={type} onSelect={() => onAddView(type)}>
									<Icon />
									{type[0].toUpperCase() + type.slice(1)}
								</DropdownMenuItem>
							)
						})}
						{views.length > 1 && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => onRemoveView(activeView.id)}
								>
									<TrashIcon />
									Delete “{activeView.name}”
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="db-tools">
				<Button
					size="sm"
					variant="ghost"
					aria-label="Filter"
					aria-expanded={filtersOpen}
					data-active={filterCount > 0 || undefined}
					className="db-tool"
					onClick={onToggleFilters}
				>
					<FilterIcon />
					{filterCount > 0 && <span className="db-tool-badge">{filterCount}</span>}
				</Button>
				<SortMenu view={activeView} properties={properties} onUpdateView={onUpdateView} />
				<LayoutMenu view={activeView} properties={properties} onUpdateView={onUpdateView} />
				<PropertiesMenu
					view={activeView}
					properties={properties}
					columns={columns}
					onUpdateView={onUpdateView}
				/>
				<InputGroup variant="search" className="db-search" aria-label="Search this database">
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search"
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
					/>
				</InputGroup>
			</div>
		</div>
	)
}
