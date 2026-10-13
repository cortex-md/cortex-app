import { type Href, router, Stack } from "expo-router"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { FormChoiceRow, FormTextField } from "@/features/importExport/FormFields"
import {
	CLOSE_ICON,
	HeaderActions,
	useCloseSheetStack,
} from "@/features/importExport/HeaderActions"
import { openSettings } from "@/features/navigation/routes"
import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"
import { ShareTemplateProvider, useShareTemplate } from "@/features/share/ShareTemplateContext"
import type { ShareAudience } from "@/features/share/shareTypes"

const AUDIENCES: { value: ShareAudience; title: string; subtitle: string }[] = [
	{ subtitle: "Listed after an automatic check", title: "Marketplace", value: "market" },
	{ subtitle: "Only people with the link", title: "Link", value: "link" },
	{ subtitle: "Shows up in your group’s templates", title: "Team", value: "team" },
]

const CTA_LABELS: Record<ShareAudience, string> = {
	link: "Create link",
	market: "Publish",
	team: "Share",
}

const DONE_TEXT: Record<ShareAudience, string> = {
	link: "People with the link can preview it and add it to their vault.",
	market: "Anyone can add it from Marketplace → Templates.",
	team: "They can add it from Marketplace → Templates → From your team.",
}

export function ShareTemplateLayout() {
	const screenOptions = useStackScreenOptions()
	return (
		<ShareTemplateProvider>
			<Stack screenOptions={{ ...screenOptions, headerLargeTitleEnabled: false }}>
				<Stack.Screen name="index" options={{ title: "Share as template" }} />
				<Stack.Screen name="done" options={{ title: "Shared" }} />
			</Stack>
		</ShareTemplateProvider>
	)
}

export function ShareTemplateScreen() {
	const share = useShareTemplate()
	const close = useCloseSheetStack()
	const { subject } = share

	function publish() {
		void share.share().then((shared) => {
			if (shared) router.push("/share-template/done" as Href)
		})
	}

	return (
		<>
			<Stack.Screen options={{ title: "Share as template" }} />
			<HeaderActions
				left={{ icon: CLOSE_ICON, label: "Close", onPress: close }}
				right={{
					disabled: share.busy || !share.name.trim(),
					label: CTA_LABELS[share.audience],
					onPress: publish,
					primary: true,
				}}
			/>
			<NativeForm>
				<FormSection title="Share to">
					{AUDIENCES.map((option) => (
						<FormChoiceRow
							key={option.value}
							onPress={() => share.setAudience(option.value)}
							selected={share.audience === option.value}
							subtitle={option.subtitle}
							title={option.title}
						/>
					))}
				</FormSection>
				{share.audience === "team" ? (
					<FormSection title="Group">
						{share.groups.map((item) => (
							<FormChoiceRow
								key={item.id ?? "everyone"}
								onPress={() => share.setGroupId(item.id)}
								selected={item.id === share.group?.id}
								subtitle={`${item.memberCount} members`}
								title={item.name}
							/>
						))}
					</FormSection>
				) : null}
				<FormSection title="Listing">
					<FormTextField initialValue={share.name} label="Name" onChangeText={share.setName} />
					<FormTextField
						initialValue={share.description}
						label="Description"
						multiline
						onChangeText={share.setDescription}
					/>
				</FormSection>
				<FormSection
					footer="Only the structure is shared. Your notes stay private unless you add samples."
					title="Includes"
				>
					<FormRow
						icon={{ md: "lock", sf: "lock" }}
						subtitle={`${subject.viewNames.join(", ")} · ${subject.propertyCount} properties`}
						title="Views and properties"
					/>
					<FormToggle
						disabled={subject.rowTemplateNames.length === 0}
						onValueChange={share.setIncludeRowTemplates}
						subtitle={subject.rowTemplateNames.join(", ") || "None yet"}
						title="Row templates"
						value={share.includeRowTemplates && subject.rowTemplateNames.length > 0}
					/>
					<FormToggle
						onValueChange={share.setIncludeSamples}
						subtitle={
							share.includeSamples
								? `${subject.sampleCount} notes, without owners and dates`
								: "Nothing from your notes is shared"
						}
						title="Sample notes"
						value={share.includeSamples}
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}

export function ShareTemplateDoneScreen() {
	const share = useShareTemplate()
	const close = useCloseSheetStack()
	const outcome = share.outcome
	if (!outcome) return null
	const title =
		outcome.audience === "market"
			? `${outcome.name} is live`
			: outcome.audience === "link"
				? "Link ready"
				: `Shared with ${outcome.groupName ?? share.groupName}`

	function viewListing() {
		close()
		openSettings("marketplace", { tab: "templates" })
	}

	return (
		<>
			<Stack.Screen options={{ title: "Shared" }} />
			<HeaderActions right={{ label: "Done", onPress: close, primary: true }} />
			<NativeForm>
				<FormSection footer={DONE_TEXT[outcome.audience]} title={title}>
					{outcome.link ? (
						<FormRow
							icon={{ md: "link", sf: "link" }}
							onPress={() => void share.copy()}
							title={outcome.link}
							value={share.copied ? "Copied" : "Copy"}
						/>
					) : null}
					{outcome.audience === "market" ? (
						<FormRow chevron onPress={viewListing} tint title="View listing" />
					) : null}
				</FormSection>
			</NativeForm>
		</>
	)
}
