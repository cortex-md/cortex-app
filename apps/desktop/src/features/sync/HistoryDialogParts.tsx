import type { DiffRow } from "@cortex/core"
import { ReadingView } from "@cortex/editor/reading-view"
import { extractFrontmatterBody } from "@cortex/properties"
import {
	Button,
	cn,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
	Spinner,
} from "@cortex/ui"
import { XIcon } from "lucide-react"
import type { ReactNode } from "react"

export { groupByDay, historyDayLabel, parseTimestamp } from "@cortex/core"

interface HistoryDialogProps {
	title: string
	description: string
	variant?: "split" | "feed"
	children: ReactNode
}

export function HistoryDialog({
	title,
	description,
	variant = "split",
	children,
}: HistoryDialogProps) {
	return (
		<DialogContent
			showCloseButton={false}
			className="history-dialog"
			data-variant={variant}
			onOpenAutoFocus={(event) => event.preventDefault()}
		>
			<DialogTitle className="sr-only">{title}</DialogTitle>
			<DialogDescription className="sr-only">{description}</DialogDescription>
			{children}
		</DialogContent>
	)
}

interface HistoryHeadProps {
	title: string
	subtitle?: ReactNode
	actions?: ReactNode
}

export function HistoryHead({ title, subtitle, actions }: HistoryHeadProps) {
	return (
		<header className="history-head">
			<div className="history-head-title">
				<b>{title}</b>
				{subtitle && <span>{subtitle}</span>}
			</div>
			{actions}
			<DialogClose asChild>
				<Button variant="ghost" size="icon-sm" aria-label="Close">
					<XIcon />
				</Button>
			</DialogClose>
		</header>
	)
}

export function HistoryDayLabel({ children }: { children: ReactNode }) {
	return <div className="history-day">{children}</div>
}

export function HistoryLoading() {
	return (
		<div className="history-state">
			<Spinner className="size-4 text-muted-foreground" />
		</div>
	)
}

export function HistoryEmpty({ title, description }: { title: string; description?: string }) {
	return (
		<div className="history-state">
			<b>{title}</b>
			{description && <span>{description}</span>}
		</div>
	)
}

export function HistoryError({ message }: { message: string }) {
	return <div className="history-error">{message}</div>
}

export function NoteReadingPreview({ content }: { content: string }) {
	return (
		<div className="history-preview">
			<ReadingView content={extractFrontmatterBody(content)} scrollMode="parent" />
		</div>
	)
}

export function HistoryDiff({ rows }: { rows: readonly DiffRow[] }) {
	if (rows.length === 0) {
		return <HistoryEmpty title="No changes" description="This version matches the one before it." />
	}
	return (
		<div className="history-diff">
			{rows.map((row) =>
				row.type === "gap" ? (
					<div key={row.id} className="history-diff-gap">
						{row.count} unchanged {row.count === 1 ? "line" : "lines"}
					</div>
				) : (
					<div key={row.id} className="history-diff-line" data-kind={row.kind}>
						<span className="history-diff-sign" aria-hidden="true">
							{row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}
						</span>
						<span>
							{row.segments.map((segment) => (
								<span key={segment.start} className={cn(segment.changed && "history-diff-word")}>
									{segment.text || "\u00a0"}
								</span>
							))}
						</span>
					</div>
				),
			)}
		</div>
	)
}
