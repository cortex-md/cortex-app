import {
	getPropertyInputType,
	isEmptyPropertyValue,
	resolveTextPropertyDraft,
} from "@cortex/properties"
import { Button, Input } from "@cortex/ui"
import { useState } from "react"
import type { PropertyValueEditorProps } from "../types"
import { usePropertyDraftCommit } from "../usePropertyDraftCommit"

export function TextValueEditor({
	definition,
	value,
	onSetValue,
	onRemoveValue,
	onClose,
}: Omit<PropertyValueEditorProps, "authorConfig" | "filePath" | "onUpdateDefinition">) {
	const [draft, setDraft] = useState(isEmptyPropertyValue(value) ? "" : String(value))
	const [error, setError] = useState<string | null>(null)
	const commit = async () => {
		const resolution = resolveTextPropertyDraft(definition.type, draft)
		if (resolution.kind === "invalid") {
			setError(resolution.message)
			return false
		}
		if (resolution.kind === "remove") await onRemoveValue()
		else await onSetValue(resolution.value)
		setError(null)
		return true
	}
	const { cancel, commitAndClose, commitOnce } = usePropertyDraftCommit(commit, onClose)

	return (
		<div className="note-property-editor">
			<Input
				autoFocus
				type={getPropertyInputType(definition.type)}
				value={draft}
				aria-label={definition.name}
				aria-invalid={Boolean(error)}
				placeholder={`Enter ${definition.name.toLocaleLowerCase()}`}
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
			{!isEmptyPropertyValue(value) && (
				<div className="note-property-popover-footer">
					<Button
						variant="ghost"
						size="xs"
						onClick={() => {
							void onRemoveValue().then(onClose)
						}}
					>
						Clear
					</Button>
				</div>
			)}
		</div>
	)
}
