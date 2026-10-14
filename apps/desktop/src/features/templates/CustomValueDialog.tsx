import {
	type CustomValueSource,
	type CustomValueSpec,
	type CustomValueTransform,
	createCustomValueExpression,
	isValidCustomValueName,
	parseCustomValueExpression,
	renderTemplateExpression,
	type TemplateRenderContext,
} from "@cortex/templates"
import {
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	NativeSelect,
	NativeSelectOption,
	Tag,
	ToggleGroup,
	ToggleGroupItem,
} from "@cortex/ui"
import { ChevronRightIcon } from "lucide-react"
import { useState } from "react"

export interface CustomValueDraft {
	id: string
	name: string
	expression: string
}

interface CustomValueDialogProps {
	value: CustomValueDraft | null
	takenNames: string[]
	context: TemplateRenderContext
	onSave: (value: { name: string; expression: string }) => void
	onClose: () => void
}

const sourceLabels: Record<CustomValueSource, string> = {
	date: "Today’s date",
	time: "Current time",
	"note.title": "Note name",
	"note.folder": "Folder",
	"vault.name": "Vault name",
}

const dateFormats = ["yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-Www", "yyyy"]
const timeFormats = ["HH:mm", "HH:mm:ss"]
const transformLabels: Record<CustomValueTransform, string> = {
	none: "As is",
	lower: "lowercase",
	upper: "UPPERCASE",
	title: "Title Case",
	slug: "slug-case",
}

const defaultSpec: CustomValueSpec = {
	source: "date",
	format: "dd/MM/yyyy",
	transform: "none",
	fallback: "",
}

function previewExpression(expression: string, context: TemplateRenderContext) {
	try {
		return { value: renderTemplateExpression(expression, context), error: null }
	} catch (error) {
		return { value: "", error: error instanceof Error ? error.message : String(error) }
	}
}

export function CustomValueDialog(props: CustomValueDialogProps) {
	return (
		<Dialog open onOpenChange={(open) => !open && props.onClose()}>
			<CustomValueContent {...props} />
		</Dialog>
	)
}

function CustomValueContent({
	value,
	takenNames,
	context,
	onSave,
	onClose,
}: CustomValueDialogProps) {
	const parsed = value ? parseCustomValueExpression(value.expression) : defaultSpec
	const [name, setName] = useState(value?.name ?? "")
	const [spec, setSpec] = useState<CustomValueSpec>(parsed ?? defaultSpec)
	const [advanced, setAdvanced] = useState(Boolean(value && !parsed))
	const [raw, setRaw] = useState(value?.expression ?? createCustomValueExpression(defaultSpec))
	const expression = advanced ? raw : createCustomValueExpression(spec)
	const preview = previewExpression(expression, context)
	const trimmedName = name.trim()
	const nameError = !trimmedName
		? null
		: !isValidCustomValueName(trimmedName)
			? "Use letters, numbers, - or _, starting with a letter."
			: takenNames.includes(trimmedName)
				? "Another value already uses this name."
				: null
	const isDate = spec.source === "date" || spec.source === "time"
	const formats = spec.source === "time" ? timeFormats : dateFormats
	const update = (patch: Partial<CustomValueSpec>) => {
		const next = { ...spec, ...patch }
		setSpec(next)
		setRaw(createCustomValueExpression(next))
	}

	return (
		<DialogContent className="template-new-dialog">
			<DialogHeader>
				<DialogTitle>{value ? "Edit value" : "New value"}</DialogTitle>
				<DialogDescription>
					A value is filled in each time someone uses the template.
				</DialogDescription>
			</DialogHeader>
			<form
				className="template-new-body"
				onSubmit={(event) => {
					event.preventDefault()
					if (trimmedName && !nameError && !preview.error) onSave({ name: trimmedName, expression })
				}}
			>
				<div className="template-new-field">
					<Label htmlFor="custom-value-name">Name</Label>
					<Input
						id="custom-value-name"
						autoFocus
						value={name}
						placeholder="dueDate"
						aria-invalid={Boolean(nameError)}
						onChange={(event) => setName(event.target.value)}
					/>
					{nameError ? <p className="template-picker-error">{nameError}</p> : null}
				</div>
				{advanced ? null : (
					<>
						<div className="template-new-field">
							<Label htmlFor="custom-value-source">Based on</Label>
							<NativeSelect
								id="custom-value-source"
								value={spec.source}
								onChange={(event) => {
									const source = event.target.value as CustomValueSource
									update({
										source,
										format: source === "time" ? "HH:mm" : source === "date" ? "yyyy-MM-dd" : "",
										transform: "none",
									})
								}}
							>
								{(Object.keys(sourceLabels) as CustomValueSource[]).map((source) => (
									<NativeSelectOption key={source} value={source}>
										{sourceLabels[source]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
						{isDate ? (
							<div className="template-new-field">
								<Label>Format</Label>
								<ToggleGroup
									type="single"
									size="sm"
									className="custom-value-options"
									value={formats.includes(spec.format) ? spec.format : ""}
									onValueChange={(format) => format && update({ format })}
								>
									{formats.map((format) => (
										<ToggleGroupItem key={format} value={format}>
											{previewExpression(`now | date("${format}")`, context).value}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>
						) : (
							<div className="template-new-field">
								<Label>Write it as</Label>
								<ToggleGroup
									type="single"
									size="sm"
									className="custom-value-options"
									value={spec.transform}
									onValueChange={(transform) =>
										transform && update({ transform: transform as CustomValueTransform })
									}
								>
									{(Object.keys(transformLabels) as CustomValueTransform[]).map((transform) => (
										<ToggleGroupItem key={transform} value={transform}>
											{transformLabels[transform]}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>
						)}
						<div className="template-new-field">
							<Label htmlFor="custom-value-fallback">If it’s empty, use</Label>
							<Input
								id="custom-value-fallback"
								value={spec.fallback}
								placeholder="Nothing"
								onChange={(event) => update({ fallback: event.target.value })}
							/>
						</div>
					</>
				)}
				<Collapsible open={advanced} onOpenChange={setAdvanced}>
					<CollapsibleTrigger asChild>
						<Button type="button" variant="ghost" size="xs" className="self-start">
							<ChevronRightIcon
								className="custom-value-chevron"
								data-open={advanced || undefined}
							/>
							Write the expression
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="template-new-field">
						<Input
							className="font-mono"
							value={raw}
							aria-label="Expression"
							onChange={(event) => setRaw(event.target.value)}
						/>
						<p className="template-new-hint">
							Use values like note.title or now, and filters like date("yyyy"), slug, upper or
							default("text").
						</p>
					</CollapsibleContent>
				</Collapsible>
				<div className="custom-value-preview">
					<span>Becomes</span>
					{preview.error ? (
						<span className="template-picker-error">{preview.error}</span>
					) : (
						<Tag variant="active">{preview.value || "(empty)"}</Tag>
					)}
				</div>
			</form>
			<DialogFooter>
				<Button variant="ghost" onClick={onClose}>
					Cancel
				</Button>
				<Button
					disabled={!trimmedName || Boolean(nameError) || Boolean(preview.error)}
					onClick={() => onSave({ name: trimmedName, expression })}
				>
					{value ? "Save value" : "Add value"}
				</Button>
			</DialogFooter>
		</DialogContent>
	)
}
