import { Host, Switch } from "@expo/ui"
import { Check, Download, Gem, Type, X } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import type { SegmentedOption } from "@/components/ui/segmentedTypes"
import { ImportProgressBar } from "@/features/importExport/ImportProgressBar"
import { formatCount } from "@/features/importExport/importPlan"
import type { DetectChoice, ObsidianMode } from "@/features/importExport/importTypes"
import {
	KeyValueRow,
	SheetBody,
	SheetBottomBar,
	SheetButton,
	SheetHero,
} from "@/features/importExport/SheetParts"
import type { ImportSheetController } from "@/features/importExport/useImportSheet"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

const NOOP = () => undefined

const MODE_OPTIONS = (vaultName: string): SegmentedOption<ObsidianMode>[] => [
	{ label: `Copy into ${vaultName}`, value: "copy" },
	{ label: "Open as a vault", value: "open" },
]

const COMES_OVER: [string, string][] = [
	["Notes and folders", "Markdown and frontmatter as they are"],
	["Attachments", "Images, PDFs, audio and video"],
	["Image embeds", "![[photo.png]] become Markdown images"],
	["Properties", "Text, number, checkbox and date types"],
	["Templates and daily notes", "Folders, date format and placeholders"],
	["Bookmarks", "Bookmarked notes"],
]

const KEPT_AS_TEXT: [string, string][] = [
	["Note embeds", "Shown as links"],
	["Highlights, comments, block IDs", "Kept in the text as written"],
]

const NOT_SUPPORTED: [string, string][] = [
	["Dataview and Templater", "The code stays in the note"],
	["Canvas and Excalidraw", "Copied as files"],
	["Community plugins", "Look for alternatives in the Marketplace"],
]

export function ImportDetectStage({ controller }: { controller: ImportSheetController }) {
	const { colors } = useMobileColors()
	const { actions, derived, state } = controller
	const folder = state.folder
	if (!folder) return null
	const options: { id: DetectChoice; title: string; subtitle: string }[] = [
		{
			id: "obs",
			subtitle: `Copies notes and attachments into ${derived.vaultName} and moves its settings.`,
			title: "Import it as an Obsidian vault",
		},
		{
			id: "open",
			subtitle: "Notes stay where they are. Obsidian and Cortex can both open it.",
			title: "Open it as its own vault",
		},
		{
			id: "files",
			subtitle: `${folder.importableFiles.length} files. Markdown notes and attachments are left out.`,
			title: "Only its CSV, HTML and PDF files",
		},
	]

	return (
		<SheetBody>
			<SheetHero
				Icon={Gem}
				subtitle={`${formatCount(folder.notes)} notes · ${formatCount(folder.attachments)} attachments · ${folder.templates} templates · ${folder.bookmarks} bookmarks`}
				tint
				title={`“${folder.name}” is an Obsidian vault`}
			/>
			<GroupedSectionHeader>How to bring it in</GroupedSectionHeader>
			<GroupedList>
				{options.map((option) => (
					<GroupedRow
						accessibilityLabel={option.title}
						key={option.id}
						onPress={() => actions.setDetectChoice(option.id)}
						subtitle={option.subtitle}
						title={option.title}
						trailing={
							state.detectChoice === option.id ? (
								<Check color={colors.tint} size={20} strokeWidth={2.4} />
							) : null
						}
					/>
				))}
			</GroupedList>
		</SheetBody>
	)
}

function CapabilityList({
	Icon,
	iconColor,
	rows,
}: {
	Icon: typeof Check
	iconColor: string
	rows: [string, string][]
}) {
	return (
		<GroupedList>
			{rows.map(([title, subtitle]) => (
				<GroupedRow
					key={title}
					leading={<Icon color={iconColor} size={20} strokeWidth={2.2} />}
					subtitle={subtitle}
					title={title}
				/>
			))}
		</GroupedList>
	)
}

export function ImportObsidianStage({ controller }: { controller: ImportSheetController }) {
	const { colors } = useMobileColors()
	const { actions, derived, state } = controller
	const folder = state.folder
	if (!folder) return null
	const isCopy = state.obsidianMode === "copy"
	const modeHelp = isCopy
		? `Copies notes and attachments into a folder of ${derived.vaultName}. Existing files are never replaced; conflicting names get a number.`
		: `Adds ${folder.name} to your vaults and applies its Obsidian settings. Notes stay where they are.`

	return (
		<SheetBody style={{ paddingBottom: 120 }}>
				<GroupedList>
					<GroupedRow
						leading={
							<View style={[styles.obsidianIcon, { backgroundColor: colors.accentSubtle }]}>
								<Gem color={colors.headingViolet} size={20} strokeWidth={2} />
							</View>
						}
						subtitle={`${folder.locationLabel} · ${formatCount(folder.totalFiles)} files`}
						title={folder.name}
						trailing={
							<Pressable accessibilityRole="button" disabled={state.busy} hitSlop={8} onPress={actions.changeFolder}>
								<Text style={[styles.inlineAction, { color: colors.tint }]}>Change</Text>
							</Pressable>
						}
					/>
				</GroupedList>
				<SegmentedControl
					accessibilityLabel="How"
					onChange={actions.setObsidianMode}
					options={MODE_OPTIONS(derived.vaultName)}
					style={styles.segment}
					value={state.obsidianMode}
				/>
				<GroupedFooter>{modeHelp}</GroupedFooter>
				{isCopy ? (
					<>
						<GroupedSectionHeader>{`Destination folder in ${derived.vaultName}`}</GroupedSectionHeader>
						<View style={styles.field}>
							<MobileTextField
								accessibilityLabel="Destination folder"
								autoCapitalize="sentences"
								autoCorrect={false}
								onChangeText={actions.setDestinationFolder}
								placeholder="Vault root"
								value={state.destinationFolder}
							/>
						</View>
						<View style={styles.switchList}>
							<GroupedList>
								<GroupedRow
									subtitle="Attachments/ and Daily/ named YYYY-MM-DD"
									title="Use Obsidian attachment and daily note settings"
									trailing={
										<Host matchContents>
											<Switch
												label="Use Obsidian attachment and daily note settings"
												onValueChange={actions.setApplySettings}
												value={state.applySettings}
											/>
										</Host>
									}
								/>
							</GroupedList>
						</View>
					</>
				) : null}
				<GroupedSectionHeader>Comes over</GroupedSectionHeader>
				<CapabilityList Icon={Check} iconColor={colors.successText} rows={COMES_OVER} />
				<GroupedSectionHeader>Kept as text</GroupedSectionHeader>
				<CapabilityList Icon={Type} iconColor={colors.secondaryLabel} rows={KEPT_AS_TEXT} />
				<GroupedSectionHeader>Not supported in Cortex</GroupedSectionHeader>
				<CapabilityList Icon={X} iconColor={colors.secondaryLabel} rows={NOT_SUPPORTED} />
				<GroupedFooter>
					Cortex reads .obsidian but never writes to it. You get a list of everything it couldn’t
					convert.
				</GroupedFooter>
		</SheetBody>
	)
}

export function ImportObsidianCta({ controller }: { controller: ImportSheetController }) {
	const { actions, state } = controller
	const folder = state.folder
	if (!folder) return null
	const cta =
		state.obsidianMode === "copy" ? `Import ${formatCount(folder.totalFiles)} files` : `Open ${folder.name}`
	return (
		<SheetBottomBar>
			{IS_IOS ? (
				<SheetButton disabled={state.busy} label={cta} onPress={actions.runObsidian} />
			) : (
				<View style={styles.fabRow}>
					<FloatingActionButton
						Icon={Download}
						label={cta}
						onPress={state.busy ? NOOP : actions.runObsidian}
						sf="arrow.down.circle"
					/>
				</View>
			)}
		</SheetBottomBar>
	)
}

export function ImportRunStage({ controller }: { controller: ImportSheetController }) {
	const { colors } = useMobileColors()
	const { actions, state } = controller
	const folder = state.folder
	const progress = state.progress
	const completed = progress?.completed ?? 0
	const total = progress?.total ?? folder?.totalFiles ?? 0
	const phase = folder && completed > folder.notes ? "attachments" : "notes"
	const text =
		completed === 0
			? "Reading vault…"
			: `${formatCount(completed)} of ${formatCount(total)} files · ${phase}`
	const footer = IS_IOS
		? "Keep Cortex open. If you cancel, files copied so far are kept."
		: "Continues in the background with a notification. If you cancel, files copied so far are kept."

	return (
		<SheetBody>
			<View style={styles.runBlock}>
				<ImportProgressBar value={total > 0 ? completed / total : 0} />
				<Text style={[styles.runText, { color: colors.secondaryLabel }]}>{text}</Text>
			</View>
			<Text style={[styles.runFooter, { color: colors.secondaryLabel }]}>{footer}</Text>
			<View style={styles.runCancel}>
				<SheetButton label="Cancel" onPress={actions.cancelRun} variant="gray" />
			</View>
		</SheetBody>
	)
}

export function ImportObsidianDoneStage({
	controller,
	onOpenFiles,
}: {
	controller: ImportSheetController
	onOpenFiles: () => void
}) {
	const { derived, state } = controller
	const folder = state.folder
	const outcome = state.outcome
	if (!folder || !outcome) return null
	const isCopy = outcome.mode === "copy"
	const copied = outcome.notes + outcome.attachments
	const title = !isCopy
		? `${folder.name} is open`
		: outcome.cancelled
			? `${formatCount(copied)} files imported`
			: `${folder.name} imported`
	const subtitle = !isCopy
		? "Its Obsidian settings now apply. Nothing in the folder was rewritten."
		: `Saved to ${derived.vaultName} / ${outcome.destinationLabel}. Your Obsidian vault wasn’t changed.`
	const showSettings = isCopy ? outcome.settingsApplied : true

	return (
		<SheetBody>
			<SheetHero subtitle={subtitle} title={title} />
			{outcome.cancelled ? (
				<GroupedFooter>Import cancelled. Files copied before cancelling were kept.</GroupedFooter>
			) : null}
			{isCopy ? (
				<>
					<GroupedSectionHeader>Content</GroupedSectionHeader>
					<GroupedList>
						<KeyValueRow label="Notes" value={formatCount(outcome.notes)} />
						<KeyValueRow label="Attachments" value={formatCount(outcome.attachments)} />
						<KeyValueRow label="Image embeds converted" value={formatCount(outcome.convertedEmbeds)} />
						<KeyValueRow label="Renamed to avoid conflicts" value={formatCount(outcome.renamed)} />
					</GroupedList>
				</>
			) : null}
			{showSettings ? (
				<>
					<GroupedSectionHeader>Settings migrated</GroupedSectionHeader>
					<GroupedList>
						<KeyValueRow label="Attachment location" value={outcome.settings.attachmentLocation} />
						<KeyValueRow label="Daily notes" value={outcome.settings.dailyNotes} />
						<KeyValueRow label="Templates" value={formatCount(outcome.settings.templates)} />
						<KeyValueRow label="Bookmarks" value={formatCount(outcome.settings.bookmarks)} />
						<KeyValueRow label="Property types" value={formatCount(outcome.settings.propertyTypes)} />
					</GroupedList>
				</>
			) : null}
			{outcome.findings.length > 0 ? (
				<>
					<GroupedSectionHeader>Not supported in Cortex</GroupedSectionHeader>
					<GroupedList>
						{outcome.findings.map((finding) => (
							<KeyValueRow
								key={finding.label}
								label={finding.label}
								subtitle={finding.examples}
								value={formatCount(finding.count)}
							/>
						))}
					</GroupedList>
				</>
			) : null}
			{isCopy && !outcome.cancelled ? (
				<GroupedFooter>The full list is saved in Imported from Obsidian.md.</GroupedFooter>
			) : null}
			<View style={styles.doneCta}>
				<SheetButton label="Open in Files" onPress={onOpenFiles} />
			</View>
		</SheetBody>
	)
}

const styles = StyleSheet.create({
	doneCta: {
		paddingTop: 8,
	},
	fabRow: {
		alignItems: "flex-end",
	},
	field: {
		paddingHorizontal: 16,
	},
	inlineAction: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "500",
		lineHeight: 20,
	},
	obsidianIcon: {
		alignItems: "center",
		borderRadius: 9,
		height: 32,
		justifyContent: "center",
		width: 32,
	},
	runBlock: {
		gap: 12,
		paddingHorizontal: 24,
		paddingTop: 40,
	},
	runCancel: {
		paddingTop: 8,
	},
	runFooter: {
		fontSize: IS_IOS ? 13 : 12,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: 36,
		marginTop: 8,
		textAlign: "center",
	},
	runText: {
		fontSize: IS_IOS ? 15 : 14,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
		textAlign: "center",
	},
	segment: {
		marginHorizontal: 16,
		marginTop: 16,
	},
	switchList: {
		marginTop: 16,
	},
})
