import {
	Button,
	cn,
	Empty,
	EmptyDescription,
	EmptyMedia,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@cortex/ui"
import { FileIcon, FolderIcon, Vault } from "lucide-react"
import type { ReactNode, Ref } from "react"

export interface SidebarToolEmptyState {
	icon: ReactNode
	message: string
	description?: ReactNode
	clearable?: boolean
}

interface SidebarToolViewProps {
	className?: string
	title?: string
	filterLabel: string
	filterIcon: ReactNode
	filterPlaceholder: string
	filterValue: string
	onFilterChange: (value: string) => void
	inputRef?: Ref<HTMLInputElement>
	headerAction?: ReactNode
	field?: ReactNode
	count?: ReactNode
	meta?: ReactNode
	hint?: ReactNode
	empty?: SidebarToolEmptyState | null
	children?: ReactNode
}

interface SidebarToolEmptyProps extends SidebarToolEmptyState {
	onClear?: () => void
}

function SidebarToolEmpty({
	icon,
	message,
	description,
	clearable,
	onClear,
}: SidebarToolEmptyProps) {
	return (
		<Empty className="sidebar-tool-empty sidebar-tool-empty-stacked">
			<EmptyMedia className="mb-0">{icon}</EmptyMedia>
			<EmptyDescription className="text-xs text-muted-foreground">{message}</EmptyDescription>
			{clearable && onClear ? (
				<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
					Clear filter
				</Button>
			) : (
				description && (
					<p className="max-w-44 text-[10px] leading-4 text-muted-foreground">{description}</p>
				)
			)}
		</Empty>
	)
}

export function SidebarNoVaultState() {
	return (
		<SidebarToolEmpty
			icon={<Vault className="size-6 text-muted-foreground" />}
			message="No vault open"
		/>
	)
}

interface SidebarNoteRowProps {
	title: string
	folder: string
	className?: string
	onOpen: () => void
	children?: ReactNode
}

export function SidebarNoteRow({
	title,
	folder,
	className,
	onOpen,
	children,
}: SidebarNoteRowProps) {
	return (
		<Button
			variant="ghost"
			className={cn("sidebar-tool-row sidebar-note-row", className)}
			onClick={onOpen}
			aria-label={`Open ${title}`}
		>
			<FileIcon className="sidebar-note-icon" />
			<span className="sidebar-note-copy">
				<span className="sidebar-note-title">{title}</span>
				{folder && (
					<span className="sidebar-note-path">
						<FolderIcon className="sidebar-note-folder-icon" />
						<span>{folder}</span>
					</span>
				)}
				{children}
			</span>
		</Button>
	)
}

export function SidebarToolView({
	className,
	title,
	filterLabel,
	filterIcon,
	filterPlaceholder,
	filterValue,
	onFilterChange,
	inputRef,
	headerAction,
	field,
	count,
	meta,
	hint,
	empty,
	children,
}: SidebarToolViewProps) {
	const filterInput = field ?? (
		<InputGroup
			variant="search"
			className={cn("sidebar-tool-field", !title && headerAction ? "flex-1" : undefined)}
			aria-label={filterLabel}
		>
			<InputGroupAddon>{filterIcon}</InputGroupAddon>
			<InputGroupInput
				ref={inputRef}
				type="text"
				value={filterValue}
				onChange={(event) => onFilterChange(event.target.value)}
				placeholder={filterPlaceholder}
			/>
		</InputGroup>
	)

	return (
		<div className={cn("sidebar-tool-view", className)}>
			<div className="sidebar-tool-header">
				{title && (
					<div className="sidebar-tool-title-row">
						<span className="sidebar-tool-title">{title}</span>
						{headerAction && <span className="sidebar-tool-title-actions">{headerAction}</span>}
					</div>
				)}
				{title ? (
					filterInput
				) : headerAction ? (
					<div className="flex items-center gap-1">
						{filterInput}
						{headerAction}
					</div>
				) : (
					filterInput
				)}
				<div className="sidebar-tool-meta-row">
					<span className="sidebar-tool-count">{count}</span>
					{meta}
				</div>
				{hint && <p className="sidebar-tool-hint">{hint}</p>}
			</div>
			<div className="sidebar-tool-scroll">
				{empty ? <SidebarToolEmpty {...empty} onClear={() => onFilterChange("")} /> : children}
			</div>
		</div>
	)
}
