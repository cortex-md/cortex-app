import { getPlatform } from "@cortex/platform"
import {
	createPropertyOption,
	getPropertyValueList,
	getSortedPropertyOptions,
	parsePropertyDate,
	type PropertyDefinition,
	resolveTextPropertyDraft,
	serializePropertyDate,
	togglePropertyValue,
} from "@cortex/properties"
import { Stack } from "expo-router"
import { useEffect, useRef, useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"
import { getCollabVaultName, listVaultMembers } from "@/features/collab/collabAdapter"
import { toast } from "@/features/feedback/useToast"
import { useRouteDefinition } from "@/features/properties/PropertiesContext"
import { PropertyDatePicker, PropertyTextField } from "@/features/properties/PropertyControls"
import type { PropertyKeyboard } from "@/features/properties/propertyControlTypes"
import { formatDate, getBaseType } from "@/features/properties/propertyPresentation"
import { popPropertyRoute, pushPropertyRoute } from "@/features/properties/propertyRoutes"
import type { NoteProperties } from "@/features/properties/useNoteProperties"

const SELECTED_ICON: SymbolName = { sf: "checkmark.circle.fill", md: "check_circle" }
const UNSELECTED_ICON: SymbolName = { sf: "circle", md: "radio_button_unchecked" }

function draftFromValue(value: unknown): string {
	if (value === undefined || value === null) return ""
	if (Array.isArray(value)) return value.map(String).join(", ")
	return String(value)
}

function keyboardFor(baseType: string): PropertyKeyboard {
	switch (baseType) {
		case "number":
			return "number"
		case "email":
			return "email"
		case "url":
			return "url"
		case "phone":
			return "phone"
		default:
			return "default"
	}
}

function ScreenTitle({ definition }: { definition: PropertyDefinition | null }) {
	return <Stack.Screen options={{ title: definition?.name ?? "Property" }} />
}

function PropertyFooterSection({
	definition,
	properties,
}: {
	definition: PropertyDefinition
	properties: NoteProperties
}) {
	return (
		<FormSection>
			<FormRow
				chevron
				icon={{ sf: "slider.horizontal.3", md: "tune" }}
				onPress={() => pushPropertyRoute("edit", { key: definition.key })}
				title="Edit property"
			/>
			<FormRow
				destructive
				icon={{ sf: "trash", md: "delete" }}
				onPress={() => {
					void properties.removeValue(definition).then((removed) => {
						if (removed) popPropertyRoute()
					})
				}}
				title="Remove from this note"
			/>
		</FormSection>
	)
}

function commitTextValue(
	properties: NoteProperties,
	definition: PropertyDefinition,
	draft: string,
): string | null {
	if (getBaseType(definition) === "tags") {
		const tags = draft
			.split(",")
			.map((tag) => tag.trim().replace(/^#/, ""))
			.filter(Boolean)
		void properties.setValue(definition, tags)
		return null
	}
	const resolution = resolveTextPropertyDraft(definition.type, draft)
	if (resolution.kind === "invalid") return resolution.message
	if (resolution.kind === "remove") void properties.removeValue(definition)
	else void properties.setValue(definition, resolution.value)
	return null
}

function TextValueForm({
	definition,
	properties,
}: {
	definition: PropertyDefinition
	properties: NoteProperties
}) {
	const initialValue = draftFromValue(properties.persistedMeta[definition.key])
	const [error, setError] = useState<string | null>(null)
	const [link, setLink] = useState(initialValue)
	const committedRef = useRef(initialValue)
	const latestRef = useRef(initialValue)
	const targetRef = useRef({ definition, properties })
	const baseType = getBaseType(definition)

	function commit(value: string) {
		latestRef.current = value
		if (value === committedRef.current) return
		const message = commitTextValue(properties, definition, value)
		setError(message)
		if (!message) committedRef.current = value
	}

	useEffect(() => {
		targetRef.current = { definition, properties }
	})

	useEffect(() => {
		const latest = latestRef
		const committed = committedRef
		const target = targetRef
		return () => {
			if (latest.current === committed.current) return
			commitTextValue(target.current.properties, target.current.definition, latest.current)
		}
	}, [])

	return (
		<NativeForm>
			<FormSection footer={error ?? undefined}>
				<PropertyTextField
					autoFocus={!initialValue}
					initialValue={initialValue}
					keyboard={keyboardFor(baseType)}
					onChangeText={(value) => {
						latestRef.current = value
						setLink(value)
						setError(null)
					}}
					onCommit={commit}
					placeholder={baseType === "tags" ? "tag, another tag" : "Empty"}
				/>
			</FormSection>
			{baseType === "url" && link.trim() ? (
				<FormSection>
					<FormRow
						icon={{ sf: "safari", md: "open_in_browser" }}
						onPress={() => void getPlatform().app.openExternalUrl(link.trim())}
						title="Open link"
					/>
					<FormRow
						icon={{ sf: "doc.on.doc", md: "content_copy" }}
						onPress={() => {
							void getPlatform()
								.clipboard.writeText(link.trim())
								.then(() => toast("Copied link"))
						}}
						title="Copy link"
					/>
				</FormSection>
			) : null}
			<PropertyFooterSection definition={definition} properties={properties} />
		</NativeForm>
	)
}

export function PropertyValueScreen() {
	const { definition, properties } = useRouteDefinition()
	return (
		<>
			<ScreenTitle definition={definition} />
			{definition ? (
				<TextValueForm definition={definition} key={definition.id} properties={properties} />
			) : (
				<NativeForm>{null}</NativeForm>
			)}
		</>
	)
}

export function PropertySelectScreen() {
	const { definition, properties } = useRouteDefinition()
	const [draft, setDraft] = useState("")
	const [fieldVersion, setFieldVersion] = useState(0)
	if (!definition) {
		return (
			<>
				<ScreenTitle definition={null} />
				<NativeForm>{null}</NativeForm>
			</>
		)
	}
	const options = getSortedPropertyOptions(definition)
	const current = properties.persistedMeta[definition.key]
	const selectedIds = new Set(getPropertyValueList(current).map(String))
	const label = draft.trim()
	const normalized = label.toLocaleLowerCase()
	const filtered = normalized
		? options.filter((option) => option.label.toLocaleLowerCase().includes(normalized))
		: options
	const canCreate =
		Boolean(label) && !options.some((option) => option.label.toLocaleLowerCase() === normalized)

	function toggle(selected: PropertyDefinition, optionId: string) {
		void properties.setValue(selected, togglePropertyValue(selected, current, optionId))
	}

	async function createOption(selected: PropertyDefinition) {
		const option = createPropertyOption(label, selected.options)
		const next = { ...selected, options: [...(selected.options ?? []), option] }
		if (!(await properties.saveDefinition(next))) return
		await properties.setValue(next, togglePropertyValue(next, current, option.id))
		setDraft("")
		setFieldVersion((version) => version + 1)
	}

	return (
		<>
			<ScreenTitle definition={definition} />
			<NativeForm>
				<FormSection>
					<PropertyTextField
						key={fieldVersion}
						onChangeText={setDraft}
						onSubmit={() => {
							if (canCreate) void createOption(definition)
						}}
						placeholder="Search or create an option"
					/>
				</FormSection>
				<FormSection>
					{canCreate ? (
						<FormRow
							icon={{ sf: "plus", md: "add" }}
							onPress={() => void createOption(definition)}
							tint
							title={`Create "${label}"`}
						/>
					) : null}
					{filtered.map((option) => (
						<FormRow
							icon={selectedIds.has(option.id) ? SELECTED_ICON : UNSELECTED_ICON}
							key={option.id}
							onPress={() => toggle(definition, option.id)}
							title={option.label}
						/>
					))}
				</FormSection>
				<PropertyFooterSection definition={definition} properties={properties} />
			</NativeForm>
		</>
	)
}

export function PropertyPersonScreen() {
	const { definition, properties } = useRouteDefinition()
	if (!definition) {
		return (
			<>
				<ScreenTitle definition={null} />
				<NativeForm>{null}</NativeForm>
			</>
		)
	}
	const authorConfig = properties.authorConfig
	const people =
		authorConfig.variant === "person"
			? authorConfig.options.map((person) => ({
					id: person.id,
					name: person.label,
					email: person.email ?? "",
				}))
			: listVaultMembers().map((person) => ({
					id: person.id,
					name: person.name,
					email: person.email,
				}))
	const current = properties.persistedMeta[definition.key]
	const selected = new Set(getPropertyValueList(current).map(String))
	const multiple = { ...definition, multiple: true }

	return (
		<>
			<ScreenTitle definition={definition} />
			<NativeForm>
				<FormSection title={`Members of ${getCollabVaultName()}`}>
					{people.map((person) => (
						<FormRow
							icon={selected.has(person.id) ? SELECTED_ICON : UNSELECTED_ICON}
							key={person.id}
							onPress={() =>
								void properties.setValue(
									definition,
									togglePropertyValue(multiple, current, person.id),
								)
							}
							subtitle={person.email || undefined}
							title={person.name}
						/>
					))}
				</FormSection>
				<PropertyFooterSection definition={definition} properties={properties} />
			</NativeForm>
		</>
	)
}

export function PropertyDateScreen() {
	const { definition, properties } = useRouteDefinition()
	if (!definition) {
		return (
			<>
				<ScreenTitle definition={null} />
				<NativeForm>{null}</NativeForm>
			</>
		)
	}
	const value = properties.persistedMeta[definition.key]
	const selected = parsePropertyDate(value) ?? null

	return (
		<>
			<ScreenTitle definition={definition} />
			<NativeForm>
				<FormSection footer={formatDate(value) ?? "No date"}>
					<PropertyDatePicker
						onChange={(date) => void properties.setValue(definition, serializePropertyDate(date))}
						value={selected}
					/>
				</FormSection>
				<PropertyFooterSection definition={definition} properties={properties} />
			</NativeForm>
		</>
	)
}
