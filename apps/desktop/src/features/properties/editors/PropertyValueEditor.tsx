import { getPropertyType } from "@cortex/properties"
import { Button, Checkbox } from "@cortex/ui"
import type { PropertyValueEditorProps } from "../types"
import { DateValueEditor } from "./DateValueEditor"
import { OptionValueEditor } from "./OptionValueEditor"
import { PersonValueEditor } from "./PersonValueEditor"
import { TagsValueEditor } from "./TagsValueEditor"
import { TextValueEditor } from "./TextValueEditor"

export function PropertyValueEditor({
	definition,
	filePath,
	value,
	authorConfig,
	onSetValue,
	onRemoveValue,
	onUpdateDefinition,
	onClose,
}: PropertyValueEditorProps) {
	const propertyType = getPropertyType(definition.type)
	if (!propertyType) {
		return <div className="note-property-editor-message">This property type is unavailable.</div>
	}
	if (propertyType.readOnly) {
		return <div className="note-property-editor-message">This property is managed by Cortex.</div>
	}
	if (propertyType.baseType === "select") {
		return (
			<OptionValueEditor
				definition={definition}
				value={value}
				onSetValue={onSetValue}
				onRemoveValue={onRemoveValue}
				onUpdateDefinition={onUpdateDefinition}
				onClose={onClose}
			/>
		)
	}
	if (propertyType.baseType === "tags") {
		return (
			<TagsValueEditor
				definition={definition}
				filePath={filePath}
				value={value}
				authorConfig={authorConfig}
				onSetValue={onSetValue}
				onRemoveValue={onRemoveValue}
				onUpdateDefinition={onUpdateDefinition}
				onClose={onClose}
			/>
		)
	}
	if (propertyType.baseType === "date") {
		return (
			<DateValueEditor
				definition={definition}
				value={value}
				onSetValue={onSetValue}
				onRemoveValue={onRemoveValue}
				onClose={onClose}
			/>
		)
	}
	if (propertyType.baseType === "person" || definition.key === "author") {
		return (
			<PersonValueEditor
				definition={definition}
				value={value}
				authorConfig={authorConfig}
				onSetValue={onSetValue}
				onRemoveValue={onRemoveValue}
				onClose={onClose}
			/>
		)
	}
	if (propertyType.baseType === "checkbox") {
		return (
			<Button
				variant="ghost"
				className="note-property-checkbox-editor"
				onClick={() => {
					void onSetValue(value !== true).then(onClose)
				}}
			>
				<Checkbox checked={value === true} aria-label={definition.name} />
				{value === true ? "Checked" : "Unchecked"}
			</Button>
		)
	}
	return (
		<TextValueEditor
			definition={definition}
			value={value}
			onSetValue={onSetValue}
			onRemoveValue={onRemoveValue}
			onClose={onClose}
		/>
	)
}
