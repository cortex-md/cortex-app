import { reportAppError } from "@cortex/core"
import type { ObsidianFindingKind, ObsidianProgress } from "@cortex/import-export"
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
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	Progress,
	Switch,
} from "@cortex/ui"
import { type FormEvent, type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react"
import { formatCount } from "@/utils/format"
import { ModalStoreHost } from "@/utils/ModalHost"
import { type ObsidianRunSummary, runObsidianImport } from "./obsidianImport"
import { type ObsidianImportTarget, obsidianImportModal } from "./obsidianImportModal"

type ObsidianImportStage =
	| { kind: "options" }
	| { kind: "running"; progress: ObsidianProgress }
	| { kind: "done"; summary: ObsidianRunSummary }

const FINDING_LABELS: Record<ObsidianFindingKind, string> = {
	"note-embed": "Note embeds (![[note]]) shown as links",
	"image-embed": "Image embeds (![[image]]) not rendered",
	"file-embed": "PDF, audio, and video embeds",
	"missing-attachment": "Embeds pointing to missing files",
	"attachment-link": "Links to non-note files",
	comment: "Comments (%%…%%) shown as text",
	"block-id": "Block IDs (^id) shown as text",
	highlight: "Highlights (==text==) shown as plain text",
	dataview: "Dataview queries",
	templater: "Templater commands (<% %>)",
	canvas: "Canvas files",
	excalidraw: "Excalidraw drawings",
	"community-plugin": "Community plugins",
	bookmark: "Bookmarks that are not notes (folders, searches, missing notes)",
	"property-type": "Property types without a Cortex equivalent",
	"attachment-setting": "Attachment folder relative to each note",
	"date-format": "Date formats Cortex cannot express",
}

const DIALOG_TITLES: Record<ObsidianImportTarget["mode"], string> = {
	import: "Import from Obsidian",
	adopt: "Use Obsidian settings",
}

export function ObsidianImportHost() {
	return (
		<ModalStoreHost store={obsidianImportModal}>
			{(target) => <ObsidianImportContent target={target} />}
		</ModalStoreHost>
	)
}

function isValidDestination(folder: string): boolean {
	return !folder.split(/[\\/]/u).some((segment) => segment === "..")
}

function ObsidianImportContent({ target }: { target: ObsidianImportTarget }) {
	const [stage, setStage] = useState<ObsidianImportStage>(() =>
		target.mode === "adopt"
			? { kind: "running", progress: { completed: 0, total: 0 } }
			: { kind: "options" },
	)
	const [destinationFolder, setDestinationFolder] = useState(
		target.mode === "import" ? target.defaultFolder : "",
	)
	const [applyVaultSettings, setApplyVaultSettings] = useState(true)
	const abortRef = useRef<AbortController | null>(null)

	const start = useEffectEvent(async () => {
		const controller = new AbortController()
		abortRef.current = controller
		setStage({ kind: "running", progress: { completed: 0, total: 0 } })
		try {
			const summary = await runObsidianImport(target, {
				destinationFolder: destinationFolder.trim().replace(/^[\\/]+|[\\/]+$/gu, ""),
				applyVaultSettings: target.mode === "adopt" || applyVaultSettings,
				signal: controller.signal,
				onProgress: (progress) => setStage({ kind: "running", progress }),
			})
			if (summary) setStage({ kind: "done", summary })
			else obsidianImportModal.close()
		} catch (error) {
			obsidianImportModal.close()
			await reportAppError({
				operation: "import-obsidian",
				source: "obsidian-import-dialog",
				cause: error,
				userMessage: "The Obsidian vault could not be imported.",
			})
		} finally {
			abortRef.current = null
		}
	})

	useEffect(() => {
		if (target.mode === "adopt") void start()
		return () => abortRef.current?.abort()
	}, [target.mode])

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault()
		if (isValidDestination(destinationFolder)) void start()
	}

	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>{DIALOG_TITLES[target.mode]}</DialogTitle>
				<DialogDescription>
					{target.mode === "import"
						? "Copy notes, attachments, and settings into this vault. The Obsidian vault is not changed."
						: "Apply this vault's Obsidian configuration. Notes stay where they are."}
				</DialogDescription>
			</DialogHeader>
			{stage.kind === "options" && (
				<form onSubmit={handleSubmit}>
					<DialogBody className="dialog-chrome-body">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="obsidian-destination">Destination folder</FieldLabel>
								<Input
									id="obsidian-destination"
									value={destinationFolder}
									placeholder="Vault root"
									onChange={(event) => setDestinationFolder(event.target.value)}
								/>
								<FieldDescription>
									Existing files are never replaced; conflicting names get a number.
								</FieldDescription>
							</Field>
							<Field orientation="horizontal" className="items-center justify-between py-2">
								<FieldLabel htmlFor="obsidian-apply-settings">
									Use Obsidian attachment and daily note settings
								</FieldLabel>
								<Switch
									id="obsidian-apply-settings"
									checked={applyVaultSettings}
									onCheckedChange={setApplyVaultSettings}
								/>
							</Field>
						</FieldGroup>
					</DialogBody>
					<DialogFooter className="dialog-chrome-footer">
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button type="submit" disabled={!isValidDestination(destinationFolder)}>
							Import
						</Button>
					</DialogFooter>
				</form>
			)}
			{stage.kind === "running" && (
				<>
					<DialogBody className="dialog-chrome-body">
						<div className="flex flex-col gap-2">
							<Progress
								value={
									stage.progress.total > 0
										? (stage.progress.completed / stage.progress.total) * 100
										: 0
								}
							/>
							<p className="m-0 text-sm text-muted-foreground">
								{stage.progress.total > 0
									? `${stage.progress.completed} of ${stage.progress.total} files`
									: "Reading vault…"}
							</p>
						</div>
					</DialogBody>
					<DialogFooter className="dialog-chrome-footer">
						<Button variant="outline" onClick={() => abortRef.current?.abort()}>
							Cancel
						</Button>
					</DialogFooter>
				</>
			)}
			{stage.kind === "done" && <ObsidianImportSummary summary={stage.summary} />}
		</DialogContent>
	)
}

interface SummaryRow {
	label: string
	value: string
	detail?: string
}

function getSummaryRows({ result }: ObsidianRunSummary): SummaryRow[] {
	const rows: SummaryRow[] = [
		{ label: "Notes", value: String(result.notes) },
		{ label: "Attachments", value: String(result.attachments) },
	]
	if (result.convertedEmbeds > 0) {
		rows.push({ label: "Image embeds converted", value: String(result.convertedEmbeds) })
	}
	if (result.renamed > 0) {
		rows.push({ label: "Renamed to avoid conflicts", value: String(result.renamed) })
	}
	if (result.failed.length > 0) {
		rows.push({
			label: "Failed",
			value: String(result.failed.length),
			detail: result.failed
				.slice(0, 5)
				.map((failure) => failure.path)
				.join(", "),
		})
	}
	return rows
}

function getSettingsRows(applied: ObsidianRunSummary["applied"]): string[] {
	if (!applied) return []
	return [
		applied.attachments ? "Attachment location" : null,
		applied.dailyNotes ? "Daily notes" : null,
		applied.templates > 0 ? formatCount(applied.templates, "template") : null,
		applied.bookmarks > 0 ? formatCount(applied.bookmarks, "bookmark") : null,
		applied.propertyTypes > 0 ? formatCount(applied.propertyTypes, "property type") : null,
	].filter((row): row is string => row !== null)
}

function ObsidianImportSummary({ summary }: { summary: ObsidianRunSummary }) {
	const rows = getSummaryRows(summary)
	const settingsRows = getSettingsRows(summary.applied)
	const { findings, cancelled } = summary.result
	return (
		<>
			<DialogBody className="dialog-chrome-body">
				<div className="flex max-h-[420px] min-h-0 flex-col gap-4 overflow-y-auto text-sm">
					{cancelled && (
						<p className="m-0 text-muted-foreground">
							Import cancelled. Files copied before cancelling were kept.
						</p>
					)}
					<SummarySection title="Content">
						{rows.map((row) => (
							<SummaryLine
								key={row.label}
								label={row.label}
								value={row.value}
								detail={row.detail}
							/>
						))}
					</SummarySection>
					{settingsRows.length > 0 && (
						<SummarySection title="Settings migrated">
							{settingsRows.map((row) => (
								<SummaryLine key={row} label={row} />
							))}
						</SummarySection>
					)}
					{findings.length > 0 && (
						<SummarySection title="Not supported in Cortex">
							{findings.map((finding) => (
								<SummaryLine
									key={finding.kind}
									label={FINDING_LABELS[finding.kind]}
									value={String(finding.count)}
									detail={finding.examples.join(", ")}
								/>
							))}
						</SummarySection>
					)}
				</div>
			</DialogBody>
			<DialogFooter className="dialog-chrome-footer">
				<DialogClose asChild>
					<Button>Done</Button>
				</DialogClose>
			</DialogFooter>
		</>
	)
}

function SummarySection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-1.5">
			<h3 className="m-0 text-xs font-medium text-muted-foreground">{title}</h3>
			<div className="flex flex-col gap-1">{children}</div>
		</section>
	)
}

function SummaryLine({ label, value, detail }: { label: string; value?: string; detail?: string }) {
	return (
		<div className="flex min-w-0 flex-col">
			<div className="flex items-baseline justify-between gap-3">
				<span className="min-w-0 truncate text-foreground">{label}</span>
				{value && <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>}
			</div>
			{detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
		</div>
	)
}
