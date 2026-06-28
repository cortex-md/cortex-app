import {
	getPropertyType,
	isEmptyPropertyValue,
	type PrimitivePropertyType,
	parsePropertyInput,
} from "@cortex/properties"
import { Input } from "@cortex/ui"
import { useState } from "react"
import type { PropertyValueEditorProps } from "../types"
import { usePropertyDraftCommit } from "../usePropertyDraftCommit"

function getValueInputType(baseType: PrimitivePropertyType): string {
	if (baseType === "number") return "number"
	if (baseType === "email") return "email"
	if (baseType === "url") return "url"
	if (baseType === "phone") return "tel"
	return "text"
}

export function InlinePropertyValueEditor({
	definition,
	value,
	onSetValue,
	onRemoveValue,
	onClose,
}: Omit<PropertyValueEditorProps, "authorConfig" | "filePath" | "onUpdateDefinition">) {
	const propertyType = getPropertyType(definition.type)
	const baseType = propertyType?.baseType ?? "text"
	const [draft, setDraft] = useState(isEmptyPropertyValue(value) ? "" : String(value))
	const [error, setError] = useState<string | null>(null)
	const commit = async () => {
		const nextValue = parsePropertyInput(baseType, draft.trim())
		if (isEmptyPropertyValue(nextValue)) {
			await onRemoveValue()
			setError(null)
			return true
		}
		const validation = propertyType?.validate(nextValue)
		if (validation && !validation.valid) {
			setError(validation.message ?? "Invalid value")
			return false
		}
		await onSetValue(nextValue)
		setError(null)
		return true
	}
	const { cancel, commitAndClose } = usePropertyDraftCommit(commit, onClose)

	return (
		<div className="note-property-inline-editor">
			<Input
				autoFocus
				size="sm"
				type={getValueInputType(baseType)}
				value={draft}
				aria-label={definition.name}
				aria-invalid={Boolean(error)}
				placeholder={`Enter ${definition.name.toLocaleLowerCase()}`}
				className="note-property-inline-input"
				onChange={(event) => setDraft(event.target.value)}
				onFocus={(event) => event.currentTarget.select()}
				onBlur={() => void commitAndClose()}
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
			{error && <output className="note-property-inline-error">{error}</output>}
		</div>
	)
}
