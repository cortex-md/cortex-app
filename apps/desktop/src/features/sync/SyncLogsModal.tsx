import { type SyncLogEntry, type SyncLogLevel, useSyncLogStore } from "@cortex/core"
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	DialogTitle,
	ToggleGroup,
	ToggleGroupItem,
} from "@cortex/ui"
import { useLayoutEffect, useRef, useState } from "react"

const LEVEL_FILTERS: Array<{ label: string; value: SyncLogLevel | "all" }> = [
	{ label: "All", value: "all" },
	{ label: "Info", value: "info" },
	{ label: "Warn", value: "warn" },
	{ label: "Error", value: "error" },
]

const LEVEL_TEXT_STYLES: Record<SyncLogLevel, string> = {
	info: "text-muted-foreground",
	warn: "text-status-warning-foreground",
	error: "text-status-error-foreground",
}

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp)
	return date.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	})
}

function formatEntryAsText(entry: SyncLogEntry): string {
	const time = formatTimestamp(entry.timestamp)
	const meta = entry.metadata
		? ` ${Object.entries(entry.metadata)
				.map(([k, v]) => `${k}=${v}`)
				.join(" ")}`
		: ""
	return `[${time}] [${entry.level.toUpperCase()}] ${entry.message}${meta}`
}

function formatMetadata(metadata: Record<string, string>): string {
	return Object.entries(metadata)
		.map(([key, value]) => `${key}=${value}`)
		.join(" · ")
}

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SyncLogsModal({ open, onOpenChange }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && <SyncLogsContent />}
		</Dialog>
	)
}

function SyncLogsContent() {
	const entries = useSyncLogStore((s) => s.entries)
	const clear = useSyncLogStore((s) => s.clear)
	const [filter, setFilter] = useState<SyncLogLevel | "all">("all")
	const scrollRef = useRef<HTMLDivElement>(null)

	const filteredEntries = filter === "all" ? entries : entries.filter((e) => e.level === filter)
	const filteredEntryCount = filteredEntries.length

	useLayoutEffect(() => {
		const scrollContainer = scrollRef.current
		if (scrollContainer && filteredEntryCount > 0) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight
		}
	}, [filteredEntryCount])

	const handleCopyToClipboard = () => {
		const text = entries.map(formatEntryAsText).join("\n")
		void navigator.clipboard.writeText(text)
	}

	return (
		<DialogContent className="flex max-h-[min(640px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
			<DialogHeader className="dialog-chrome-header shrink-0">
				<DialogTitle className="text-base leading-5">Sync logs</DialogTitle>
			</DialogHeader>

			<div className="dialog-chrome-toolbar">
				<ToggleGroup
					type="single"
					value={filter}
					onValueChange={(value) => value && setFilter(value as SyncLogLevel | "all")}
					variant="default"
					size="sm"
					spacing={1}
					aria-label="Filter sync logs"
					className="p-0"
				>
					{LEVEL_FILTERS.map((levelFilter) => (
						<ToggleGroupItem
							key={levelFilter.value}
							value={levelFilter.value}
							aria-label={`Show ${levelFilter.label.toLowerCase()} logs`}
							className="h-6 min-w-0 px-2 text-xs text-muted-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground"
						>
							{levelFilter.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<div className="flex items-center">
					<Button
						variant="ghost"
						size="xs"
						onClick={clear}
						disabled={entries.length === 0}
						className="text-muted-foreground"
					>
						Clear
					</Button>
					<Button
						variant="ghost"
						size="xs"
						onClick={handleCopyToClipboard}
						disabled={entries.length === 0}
						className="text-muted-foreground"
					>
						Copy
					</Button>
				</div>
			</div>

			<div
				ref={scrollRef}
				data-slot="sync-log-list"
				className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
			>
				{filteredEntryCount === 0 ? (
					<DialogBody className="flex min-h-48 flex-col items-center justify-center gap-1 px-6 text-center">
						<p className="m-0 text-[13px] text-foreground">
							{entries.length === 0 ? "No sync activity yet" : "No matching log entries"}
						</p>
						<p className="m-0 text-xs text-muted-foreground">
							{entries.length === 0
								? "Activity will appear here while sync is running."
								: "Choose another level."}
						</p>
					</DialogBody>
				) : (
					<div>
						{filteredEntries.map((entry) => (
							<LogEntry key={entry.id} entry={entry} />
						))}
					</div>
				)}
			</div>
		</DialogContent>
	)
}

function LogEntry({ entry }: { entry: SyncLogEntry }) {
	return (
		<div
			data-level={entry.level}
			className="grid grid-cols-[56px_38px_minmax(0,1fr)] items-start gap-2 rounded-[6px] px-3 py-2 transition-colors hover:bg-muted/40"
		>
			<time
				dateTime={new Date(entry.timestamp).toISOString()}
				title={new Date(entry.timestamp).toLocaleString()}
				className="pt-px font-mono text-[11px] tabular-nums text-muted-foreground"
			>
				{formatTimestamp(entry.timestamp)}
			</time>
			<span
				className={`pt-px text-[10px] font-medium uppercase tracking-wide ${LEVEL_TEXT_STYLES[entry.level]}`}
			>
				{entry.level}
			</span>
			<p className="m-0 min-w-0 break-words text-[13px] leading-5 text-foreground">
				{entry.message}
				{entry.metadata && (
					<span className="ml-2 font-mono text-[11px] text-muted-foreground">
						{formatMetadata(entry.metadata)}
					</span>
				)}
			</p>
		</div>
	)
}
