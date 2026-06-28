import { getPropertyType } from "@cortex/properties"
import { Button, Popover, PopoverAnchor, PopoverContent } from "@cortex/ui"
import { ChevronRightIcon } from "lucide-react"
import { useState } from "react"
import { InlinePropertyValueEditor } from "./editors/InlinePropertyValueEditor"
import { PropertyValueEditor } from "./editors/PropertyValueEditor"
import { PropertyColorPicker } from "./inspectors/PropertyColorPicker"
import { PropertyOptionEditor } from "./inspectors/PropertyOptionEditor"
import { PropertySettings } from "./inspectors/PropertySettings"
import { PropertySortPicker } from "./inspectors/PropertySortPicker"
import { PropertyTypePicker } from "./inspectors/PropertyTypePicker"
import { usePropertyInspectorStack } from "./inspectors/usePropertyInspectorStack"
import { PropertyTypeIcon } from "./PropertyTypeIcon"
import { PropertyValueDisplay } from "./PropertyValueDisplay"
import type { PropertyRowProps } from "./types"

const inlineEditableBaseTypes = new Set(["text", "number", "email", "url", "phone"])

interface PropertyRowPanelProps
	extends Pick<
		PropertyRowProps,
		| "definition"
		| "filePath"
		| "value"
		| "schema"
		| "authorConfig"
		| "onSetValue"
		| "onRemoveValue"
		| "onUpdateDefinition"
		| "onDeleteDefinition"
		| "onDuplicateDefinition"
	> {
	inspector: ReturnType<typeof usePropertyInspectorStack>
	close: () => void
}

function PropertyRowPanel({
	definition,
	filePath,
	value,
	schema,
	authorConfig,
	onSetValue,
	onRemoveValue,
	onUpdateDefinition,
	onDeleteDefinition,
	onDuplicateDefinition,
	inspector,
	close,
}: PropertyRowPanelProps) {
	if (inspector.currentPanel.kind === "settings") {
		return (
			<PropertySettings
				definition={definition}
				schema={schema}
				onPush={inspector.pushPanel}
				onUpdateDefinition={onUpdateDefinition}
				onDeleteDefinition={async () => {
					await onDeleteDefinition(definition)
					close()
				}}
				onDuplicateDefinition={async () => {
					await onDuplicateDefinition(definition)
					close()
				}}
			/>
		)
	}
	if (inspector.currentPanel.kind === "types") {
		return (
			<PropertyTypePicker
				definition={definition}
				onBack={inspector.popPanel}
				onUpdateDefinition={onUpdateDefinition}
			/>
		)
	}
	if (inspector.currentPanel.kind === "sort") {
		return (
			<PropertySortPicker
				definition={definition}
				onBack={inspector.popPanel}
				onUpdateDefinition={onUpdateDefinition}
			/>
		)
	}
	if (inspector.currentPanel.kind === "option") {
		return (
			<PropertyOptionEditor
				definition={definition}
				optionId={inspector.currentPanel.optionId}
				onBack={inspector.popPanel}
				onPush={inspector.pushPanel}
				onUpdateDefinition={onUpdateDefinition}
			/>
		)
	}
	if (inspector.currentPanel.kind === "color") {
		return (
			<PropertyColorPicker
				definition={definition}
				optionId={inspector.currentPanel.optionId}
				onBack={inspector.popPanel}
				onUpdateDefinition={onUpdateDefinition}
			/>
		)
	}
	return (
		<PropertyValueEditor
			definition={definition}
			filePath={filePath}
			value={value}
			authorConfig={authorConfig}
			onSetValue={(nextValue) => onSetValue(definition, nextValue)}
			onRemoveValue={() => onRemoveValue(definition)}
			onUpdateDefinition={onUpdateDefinition}
			onClose={close}
		/>
	)
}

export function PropertyRow({
	definition,
	filePath,
	value,
	schema,
	authorConfig,
	definitionConfigurable = true,
	onSetValue,
	onRemoveValue,
	onUpdateDefinition,
	onDeleteDefinition,
	onDuplicateDefinition,
}: PropertyRowProps) {
	const [open, setOpen] = useState(false)
	const inspector = usePropertyInspectorStack()
	const propertyType = getPropertyType(definition.type)
	const readOnly = propertyType?.readOnly === true
	const unavailable = !propertyType
	const inlineEditable =
		Boolean(propertyType && inlineEditableBaseTypes.has(propertyType.baseType)) &&
		!(definition.key === "author" && authorConfig.variant === "person")
	const checkboxValue = propertyType?.baseType === "checkbox"
	const [inlineEditing, setInlineEditing] = useState(false)
	const close = () => setOpen(false)
	const openPanel = (panel: Parameters<typeof inspector.openPanel>[0]) => {
		setInlineEditing(false)
		inspector.openPanel(panel)
		setOpen(true)
	}
	const startInlineEditing = () => {
		setOpen(false)
		inspector.resetPanels()
		setInlineEditing(true)
	}
	const toggleCheckboxValue = () => {
		void onSetValue(definition, value !== true)
	}

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen)
				if (!nextOpen) inspector.resetPanels()
			}}
		>
			<div className="note-property-row" data-read-only={readOnly || undefined}>
				{definitionConfigurable ? (
					<Button
						variant="ghost"
						className="note-property-name"
						disabled={unavailable}
						onClick={(event) => {
							event.stopPropagation()
							openPanel({ kind: "settings" })
						}}
					>
						<PropertyTypeIcon icon={propertyType?.icon ?? "circle-help"} />
						<span>{definition.name}</span>
						<ChevronRightIcon className="note-property-settings-chevron" />
					</Button>
				) : (
					<div className="note-property-name note-property-name-static">
						<PropertyTypeIcon icon={propertyType?.icon ?? "circle-help"} />
						<span>{definition.name}</span>
					</div>
				)}
				<PopoverAnchor asChild>
					<div className="note-property-value-anchor">
						{inlineEditing ? (
							<div className="note-property-value note-property-value-inline">
								<InlinePropertyValueEditor
									definition={definition}
									value={value}
									onSetValue={(nextValue) => onSetValue(definition, nextValue)}
									onRemoveValue={() => onRemoveValue(definition)}
									onClose={() => setInlineEditing(false)}
								/>
							</div>
						) : (
							<Button
								variant="ghost"
								className="note-property-value"
								aria-label={definition.name}
								disabled={readOnly || unavailable}
								onClick={(event) => {
									event.stopPropagation()
									if (checkboxValue) {
										toggleCheckboxValue()
										return
									}
									if (inlineEditable) {
										startInlineEditing()
										return
									}
									openPanel({ kind: "value" })
								}}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return
									event.preventDefault()
									if (checkboxValue) {
										toggleCheckboxValue()
										return
									}
									if (inlineEditable) {
										startInlineEditing()
										return
									}
									openPanel({ kind: "value" })
								}}
							>
								<PropertyValueDisplay
									definition={definition}
									value={value}
									authorConfig={authorConfig}
								/>
							</Button>
						)}
					</div>
				</PopoverAnchor>
			</div>
			<PopoverContent
				align="start"
				side="bottom"
				sideOffset={4}
				collisionPadding={12}
				className="note-property-popover"
				onEscapeKeyDown={(event) => {
					if (inspector.panelCount <= 1) return
					event.preventDefault()
					inspector.popPanel()
				}}
			>
				<PropertyRowPanel
					definition={definition}
					filePath={filePath}
					value={value}
					schema={schema}
					authorConfig={authorConfig}
					onSetValue={onSetValue}
					onRemoveValue={onRemoveValue}
					onUpdateDefinition={onUpdateDefinition}
					onDeleteDefinition={onDeleteDefinition}
					onDuplicateDefinition={onDuplicateDefinition}
					inspector={inspector}
					close={close}
				/>
			</PopoverContent>
		</Popover>
	)
}
