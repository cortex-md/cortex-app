import { getErrorMessage, useVaultStore } from "@cortex/core"
import { Host, Switch } from "@expo/ui"
import { useLocalSearchParams } from "expo-router"
import { Check, Circle, CircleDot, Lock } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import type { SegmentedOption } from "@/components/ui/segmentedTypes"
import { StatusPill, statusToneFromLabel } from "@/components/ui/StatusPill"
import { toast } from "@/features/feedback/useToast"
import { SheetNavBar } from "@/features/importExport/SheetNavBar"
import { SheetBody, SheetButton, SheetHero } from "@/features/importExport/SheetParts"
import { dismissSheet, openSettings } from "@/features/navigation/routes"
import { copyShareLink, loadShareGroups, loadShareSubject, publishTemplate } from "@/features/share/shareAdapter"
import { FIXTURE_LISTING_NAME } from "@/features/share/shareFixtures"
import type { ShareAudience, ShareGroup, ShareSubject, ShareTemplateOutcome } from "@/features/share/shareTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

const AUDIENCE_OPTIONS: SegmentedOption<ShareAudience>[] = [
	{ label: "Marketplace", value: "market" },
	{ label: "Link", value: "link" },
	{ label: "Team", value: "team" },
]

const CTA_LABELS: Record<ShareAudience, string> = {
	link: "Create link",
	market: "Publish",
	team: "Share with team",
}

const DONE_TEXT: Record<ShareAudience, string> = {
	link: "People with the link can preview it and add it to their vault.",
	market:
		"Anyone can add it from Marketplace → Templates. When you change the views, publish an update from the same menu.",
	team: "They can add it from Marketplace → Templates → From your team.",
}

type Attempt = { ok: true; outcome: ShareTemplateOutcome } | { ok: false; error: string }

async function attemptPublish(
	...args: Parameters<typeof publishTemplate>
): Promise<Attempt> {
	try {
		return { ok: true, outcome: await publishTemplate(...args) }
	} catch (error) {
		return { error: getErrorMessage(error), ok: false }
	}
}

async function attemptCopy(link: string): Promise<boolean> {
	try {
		await copyShareLink(link)
		return true
	} catch {
		return false
	}
}

function AudienceTabs({
	onChange,
	value,
}: {
	onChange: (value: ShareAudience) => void
	value: ShareAudience
}) {
	const { colors } = useMobileColors()
	if (IS_IOS) {
		return (
			<SegmentedControl
				accessibilityLabel="Share with"
				onChange={onChange}
				options={AUDIENCE_OPTIONS}
				style={styles.segment}
				value={value}
			/>
		)
	}
	return (
		<View style={[styles.tabs, { borderBottomColor: colors.separator }]}>
			{AUDIENCE_OPTIONS.map((option) => {
				const selected = option.value === value
				return (
					<Pressable
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						android_ripple={{ color: colors.hover }}
						key={option.value}
						onPress={() => onChange(option.value)}
						style={styles.tab}
					>
						<Text style={[styles.tabLabel, { color: selected ? colors.tint : colors.secondaryLabel }]}>
							{option.label}
						</Text>
						{selected ? <View style={[styles.tabIndicator, { backgroundColor: colors.tintFill }]} /> : null}
					</Pressable>
				)
			})}
		</View>
	)
}

function ListingField({
	label,
	multiline = false,
	onChangeText,
	value,
}: {
	label: string
	multiline?: boolean
	onChangeText: (value: string) => void
	value: string
}) {
	const { colors } = useMobileColors()
	if (!IS_IOS) {
		return (
			<MobileTextField
				label={label}
				multiline={multiline}
				onChangeText={onChangeText}
				style={multiline ? styles.m3Multiline : undefined}
				value={value}
			/>
		)
	}
	return (
		<View style={[styles.field, multiline ? styles.fieldMultiline : null]}>
			<Text style={[styles.fieldLabel, { color: colors.secondaryLabel }]}>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				multiline={multiline}
				onChangeText={onChangeText}
				placeholderTextColor={colors.placeholder}
				style={[styles.fieldInput, { color: colors.label }]}
				value={value}
			/>
		</View>
	)
}

function PreviewCard({ name, subject }: { name: string; subject: ShareSubject }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.previewCard, { backgroundColor: colors.cell }]}>
			<Text style={[styles.caption, { color: colors.secondaryLabel }]}>How it will look</Text>
			<Text numberOfLines={1} style={[styles.previewName, { color: colors.label }]}>
				{name}
			</Text>
			<View style={[styles.previewRows, { backgroundColor: colors.fill }]}>
				{subject.previewRows.map((row) => (
					<View key={row.title} style={styles.previewRow}>
						<Text numberOfLines={1} style={[styles.previewRowTitle, { color: colors.label }]}>
							{row.title}
						</Text>
						<StatusPill compact label={row.status} tone={statusToneFromLabel(row.status)} />
						<Text style={[styles.previewRowDate, { color: colors.secondaryLabel }]}>{row.date}</Text>
					</View>
				))}
			</View>
			<Text style={[styles.caption, { color: colors.secondaryLabel }]}>
				{`${subject.ownerName} · Database`}
			</Text>
		</View>
	)
}

export function ShareTemplateSheet() {
	const { colors } = useMobileColors()
	const { folderPath } = useLocalSearchParams<{ folderPath?: string }>()
	const vaultName = useVaultStore((state) => state.vault?.name ?? "this vault")
	const subject = useMemo(() => loadShareSubject(folderPath), [folderPath])
	const groups = useMemo<ShareGroup[]>(() => loadShareGroups(vaultName), [vaultName])
	const [audience, setAudience] = useState<ShareAudience>("market")
	const [groupId, setGroupId] = useState<string | null>(() => groups[0]?.id ?? null)
	const [name, setName] = useState(() =>
		subject.folderPath ? subject.name : FIXTURE_LISTING_NAME,
	)
	const [description, setDescription] = useState(subject.description)
	const [includeRowTemplates, setIncludeRowTemplates] = useState(true)
	const [includeSamples, setIncludeSamples] = useState(false)
	const [busy, setBusy] = useState(false)
	const [outcome, setOutcome] = useState<ShareTemplateOutcome | null>(null)
	const [copied, setCopied] = useState(false)

	const group = groups.find((item) => item.id === groupId) ?? groups[0]
	const groupName = group?.name ?? `Everyone in ${vaultName}`
	const footer =
		audience === "market"
			? "Listed after an automatic check"
			: audience === "link"
				? "Not listed in search"
				: `Shows up in ${groupName}’s Templates`
	const cta = CTA_LABELS[audience]
	const canPublish = !busy && name.trim().length > 0

	const changeAudience = (next: ShareAudience) => {
		setAudience(next)
		setOutcome(null)
		setCopied(false)
	}

	const share = async () => {
		if (!canPublish) return
		setBusy(true)
		const result = await attemptPublish(
			{
				audience,
				description: description.trim(),
				groupId: audience === "team" ? (group?.id ?? null) : null,
				includeRowTemplates,
				includeSamples,
				name: name.trim(),
				subject,
			},
			audience === "team" ? groupName : null,
		)
		setBusy(false)
		if (!result.ok) {
			toast(result.error)
			return
		}
		setCopied(false)
		setOutcome(result.outcome)
	}

	const copy = async () => {
		if (!outcome?.link) return
		const ok = await attemptCopy(outcome.link)
		setCopied(ok)
		toast(ok ? "Link copied" : "Couldn’t copy the link")
	}

	const editListing = () => {
		setOutcome(null)
		setCopied(false)
	}

	const viewListing = () => {
		dismissSheet()
		openSettings("marketplace", { tab: "templates" })
	}

	const editing = outcome === null
	const title = editing ? `Share “${subject.name}” as a template` : "Shared"

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetNavBar
				leading={{ kind: "close", onPress: dismissSheet }}
				title={title}
				trailing={
					!IS_IOS && editing
						? { disabled: !canPublish, kind: "text", label: cta, onPress: share }
						: { kind: "none" }
				}
			/>
			{!IS_IOS && editing ? <AudienceTabs onChange={changeAudience} value={audience} /> : null}
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				style={styles.scroll}
			>
				{editing ? (
					<SheetBody>
						{IS_IOS ? <AudienceTabs onChange={changeAudience} value={audience} /> : null}
						{audience === "team" ? (
							<>
								<GroupedSectionHeader>Group</GroupedSectionHeader>
								<GroupedList>
									{groups.map((item) => {
										const selected = item.id === group?.id
										return (
											<GroupedRow
												accessibilityLabel={item.name}
												key={item.id ?? "everyone"}
												leading={
													IS_IOS ? undefined : selected ? (
														<CircleDot color={colors.tint} size={24} strokeWidth={2} />
													) : (
														<Circle color={colors.secondaryLabel} size={24} strokeWidth={2} />
													)
												}
												onPress={() => setGroupId(item.id)}
												subtitle={`${item.memberCount} members`}
												title={item.name}
												trailing={
													IS_IOS && selected ? (
														<Check color={colors.tint} size={20} strokeWidth={2.4} />
													) : null
												}
											/>
										)
									})}
								</GroupedList>
							</>
						) : null}
						{IS_IOS ? <GroupedSectionHeader>Listing</GroupedSectionHeader> : null}
						{IS_IOS ? (
							<GroupedList>
								<ListingField label="Name" onChangeText={setName} value={name} />
								<ListingField label="Description" multiline onChangeText={setDescription} value={description} />
							</GroupedList>
						) : (
							<View style={styles.m3Fields}>
								<ListingField label="Name" onChangeText={setName} value={name} />
								<ListingField label="Description" multiline onChangeText={setDescription} value={description} />
							</View>
						)}
						<GroupedSectionHeader>Includes</GroupedSectionHeader>
						<GroupedList>
							<GroupedRow
								subtitle={`${subject.viewNames.join(", ")} · ${subject.propertyCount} properties`}
								title="Views and properties"
								trailing={<Lock color={colors.tertiaryLabel} size={16} strokeWidth={2.2} />}
							/>
							<GroupedRow
								subtitle={subject.rowTemplateNames.join(", ") || "None yet"}
								title="Row templates"
								trailing={
									<Host matchContents>
										<Switch
											disabled={subject.rowTemplateNames.length === 0}
											label="Row templates"
											onValueChange={setIncludeRowTemplates}
											value={includeRowTemplates}
										/>
									</Host>
								}
							/>
							<GroupedRow
								subtitle={
									includeSamples
										? `${subject.sampleCount} notes, with owners and dates removed`
										: "Off — nothing from your notes is shared"
								}
								title="Sample notes"
								trailing={
									<Host matchContents>
										<Switch label="Sample notes" onValueChange={setIncludeSamples} value={includeSamples} />
									</Host>
								}
							/>
						</GroupedList>
						<GroupedSectionHeader>Preview</GroupedSectionHeader>
						<PreviewCard name={name.trim() || subject.name} subject={subject} />
						<GroupedFooter>
							Only the structure is shared. Your notes stay private unless you add samples.
						</GroupedFooter>
						<GroupedFooter>{footer}</GroupedFooter>
						<View style={styles.cta}>
							<SheetButton disabled={!canPublish} label={cta} onPress={share} />
						</View>
					</SheetBody>
				) : (
					<SheetBody>
						<SheetHero
							subtitle={DONE_TEXT[outcome.audience]}
							title={
								outcome.audience === "market"
									? `${outcome.name} is live`
									: outcome.audience === "link"
										? "Link ready"
										: `Shared with ${outcome.groupName ?? groupName}`
							}
						/>
						{outcome.link ? (
							<GroupedList>
								<GroupedRow
									title={outcome.link}
									trailing={
										<Pressable
											accessibilityRole="button"
											onPress={copy}
											style={({ pressed }) => [
												styles.copyButton,
												{ backgroundColor: pressed ? colors.fill2 : colors.fill },
											]}
										>
											<Text style={[styles.copyLabel, { color: colors.label }]}>
												{copied ? "Copied" : "Copy"}
											</Text>
										</Pressable>
									}
								/>
							</GroupedList>
						) : null}
						<View style={styles.doneActions}>
							{outcome.audience === "market" ? (
								<SheetButton label="View listing" onPress={viewListing} />
							) : outcome.audience === "team" ? (
								<SheetButton label="Done" onPress={dismissSheet} />
							) : null}
							<SheetButton label="Edit listing" onPress={editListing} variant="plain" />
						</View>
					</SheetBody>
				)}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	caption: {
		fontSize: IS_IOS ? 13 : 12,
		lineHeight: IS_IOS ? 18 : 16,
	},
	content: {
		paddingTop: 4,
	},
	copyButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 32,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	copyLabel: {
		fontSize: 14,
		fontWeight: "600",
		lineHeight: 18,
	},
	cta: {
		paddingTop: 14,
	},
	doneActions: {
		gap: 10,
		paddingTop: 18,
	},
	field: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 52,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	fieldInput: {
		flex: 1,
		fontSize: 17,
		lineHeight: 22,
		padding: 0,
	},
	fieldLabel: {
		fontSize: 17,
		lineHeight: 22,
		width: 96,
	},
	fieldMultiline: {
		alignItems: "flex-start",
		minHeight: 76,
		paddingTop: 14,
	},
	m3Fields: {
		gap: 20,
		paddingHorizontal: 16,
		paddingTop: 24,
	},
	m3Multiline: {
		minHeight: 88,
		textAlignVertical: "top",
	},
	previewCard: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		gap: 8,
		marginHorizontal: 16,
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	previewName: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		lineHeight: IS_IOS ? 22 : 24,
	},
	previewRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: 22,
	},
	previewRowDate: {
		fontSize: 13,
		lineHeight: 22,
	},
	previewRowTitle: {
		flex: 1,
		fontSize: 13,
		lineHeight: 22,
	},
	previewRows: {
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	segment: {
		marginBottom: 4,
		marginHorizontal: 16,
	},
	tab: {
		alignItems: "center",
		flex: 1,
		height: 48,
		justifyContent: "center",
	},
	tabIndicator: {
		borderTopLeftRadius: 3,
		borderTopRightRadius: 3,
		bottom: 0,
		height: 3,
		position: "absolute",
		width: 48,
	},
	tabLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	tabs: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
	},
})
