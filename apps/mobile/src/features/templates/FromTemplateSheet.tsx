import { useTemplateStore } from "@cortex/core"
import { type Href, router, Stack, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import {
	CLOSE_ICON,
	HeaderActions,
	useCloseSheetStack,
} from "@/features/importExport/HeaderActions"
import { openSettings } from "@/features/navigation/routes"
import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"
import { TemplatePreviewScreen } from "@/features/templates/TemplatePreviewStep"
import {
	BLANK_TEMPLATE_ENTRY,
	resolveMarketplaceEntry,
	type TemplateEntry,
	useTeamDatabaseTemplates,
	useTemplateSections,
} from "@/features/templates/templatesAdapter"

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

function routeHref(pathname: string, params: Record<string, string | undefined>): Href {
	return { params, pathname } as Href
}

function openPreview(key: string, title?: string) {
	router.push(routeHref("/from-template/preview", { key, title }))
}

export function FromTemplateLayout() {
	const screenOptions = useStackScreenOptions()

	return (
		<Stack screenOptions={{ ...screenOptions, headerLargeTitleEnabled: false }}>
			<Stack.Screen name="index" options={{ title: "New from template" }} />
		</Stack>
	)
}

function TemplateRow({ entry, onPress }: { entry: TemplateEntry; onPress: () => void }) {
	return (
		<FormRow
			chevron
			icon={entry.icon}
			onPress={onPress}
			subtitle={entry.hint || undefined}
			title={entry.name}
		/>
	)
}

export function FromTemplateScreen() {
	const params = useLocalSearchParams<{ templateId?: string | string[] }>()
	const close = useCloseSheetStack()
	const [query, setQuery] = useState("")
	const { sections, vault } = useTemplateSections(query)
	const templates = useTemplateStore((state) => state.templates)
	const teamDatabases = useTeamDatabaseTemplates()
	const requestedId = readParam(params.templateId)

	const requestedEntry = useMemo(
		() =>
			requestedId && vault
				? resolveMarketplaceEntry(requestedId, templates, vault, teamDatabases)
				: null,
		[requestedId, teamDatabases, templates, vault],
	)

	if (requestedEntry && vault) {
		return (
			<TemplatePreviewScreen
				entry={requestedEntry}
				initialTitle=""
				key={requestedEntry.key}
				standalone
				vault={vault}
			/>
		)
	}

	const trimmedQuery = query.trim()
	const noMatch = Boolean(trimmedQuery) && sections.length === 0

	function manageTemplates() {
		close()
		openSettings("templates")
	}

	function browseMarketplace() {
		close()
		openSettings("marketplace", { tab: "templates" })
	}

	return (
		<>
			<Stack.Screen options={{ title: "New from template" }} />
			<Stack.SearchBar
				hideWhenScrolling={false}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder="Search templates"
			/>
			<HeaderActions
				left={{ icon: CLOSE_ICON, label: "Close", onPress: close }}
				right={{
					icon: { md: "tune", sf: "slider.horizontal.3" },
					label: "Manage templates",
					onPress: manageTemplates,
				}}
			/>
			<NativeForm>
				{sections.map((section) => (
					<FormSection key={section.key} title={section.title}>
						{section.entries.map((entry) => (
							<TemplateRow entry={entry} key={entry.key} onPress={() => openPreview(entry.key)} />
						))}
					</FormSection>
				))}
				{noMatch ? (
					<FormSection>
						<FormRow
							icon={{ md: "add", sf: "plus" }}
							onPress={() => openPreview(BLANK_TEMPLATE_ENTRY.key, trimmedQuery)}
							tint
							title={`Blank note “${trimmedQuery}”`}
						/>
					</FormSection>
				) : null}
				<FormSection>
					<FormRow
						chevron
						icon={{ md: "storefront", sf: "storefront" }}
						onPress={browseMarketplace}
						tint
						title="Browse marketplace"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}

export function FromTemplatePreviewScreen() {
	const params = useLocalSearchParams<{ key?: string | string[]; title?: string | string[] }>()
	const key = readParam(params.key)
	const { sections, vault } = useTemplateSections("")
	const entry = useMemo(() => {
		if (key === BLANK_TEMPLATE_ENTRY.key) return BLANK_TEMPLATE_ENTRY
		for (const section of sections) {
			const found = section.entries.find((item) => item.key === key)
			if (found) return found
		}
		return null
	}, [key, sections])

	if (!entry || !vault) return <Stack.Screen options={{ title: "Template" }} />
	return (
		<TemplatePreviewScreen
			entry={entry}
			initialTitle={readParam(params.title) ?? ""}
			key={entry.key}
			vault={vault}
		/>
	)
}
