import { parsePropertyDate, serializePropertyDate } from "@cortex/properties"
import { Button, Calendar, Input } from "@cortex/ui"
import { useCallback, useState } from "react"
import { formatShortDate } from "@/utils/format"
import type { PropertyValueEditorProps } from "../types"
import { usePropertyDraftCommit } from "../usePropertyDraftCommit"

function formatDate(value: unknown): string {
	const date = parsePropertyDate(value)
	return date ? formatShortDate(date) : String(value ?? "")
}

export function DateValueEditor({
	definition,
	value,
	onSetValue,
	onRemoveValue,
	onClose,
}: Omit<PropertyValueEditorProps, "authorConfig" | "filePath" | "onUpdateDefinition">) {
	const selected = parsePropertyDate(value)
	const [draft, setDraft] = useState(selected ? formatDate(value) : "")
	const [month, setMonth] = useState(() => selected ?? new Date())
	const [error, setError] = useState<string | null>(null)
	const commit = async () => {
		if (!draft.trim()) {
			await onRemoveValue()
			setError(null)
			return true
		}
		const parsed = new Date(draft)
		if (Number.isNaN(parsed.getTime())) {
			setError("Enter a valid date")
			return false
		}
		await onSetValue(serializePropertyDate(parsed))
		setError(null)
		return true
	}
	const { cancel, commitAndClose, commitOnce } = usePropertyDraftCommit(commit, onClose)
	const handleSelectToday = useCallback(() => {
		const today = new Date()
		const serialized = serializePropertyDate(today)
		setMonth(today)
		setDraft(formatDate(serialized))
		void onSetValue(serialized)
	}, [onSetValue])

	return (
		<div className="note-property-date-editor">
			<Input
				autoFocus
				value={draft}
				aria-label={definition.name}
				aria-invalid={Boolean(error)}
				placeholder="Jun 18, 2026"
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => void commitOnce()}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault()
						void commitAndClose()
					}
					if (event.key === "Escape") {
						event.preventDefault()
						cancel()
					}
				}}
			/>
			{error && <output className="note-properties-error">{error}</output>}
			<Calendar
				mode="single"
				month={month}
				selected={selected}
				weekStartsOn={1}
				onMonthChange={setMonth}
				onSelect={(date) => {
					if (!date) return
					const serialized = serializePropertyDate(date)
					setDraft(formatDate(serialized))
					void onSetValue(serialized)
				}}
			/>
			<div className="note-property-popover-footer">
				<Button variant="ghost" size="xs" onClick={handleSelectToday}>
					Today
				</Button>
				<Button
					variant="ghost"
					size="xs"
					disabled={!selected}
					onClick={() => {
						void onRemoveValue().then(onClose)
					}}
				>
					Clear
				</Button>
			</div>
		</div>
	)
}
