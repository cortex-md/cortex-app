import {
	convertFolderToDatabase,
	createDatabase,
	getBaseName,
	getErrorMessage,
	type SharedDatabasePreset,
	toVaultRelativePath,
	useTemplateSharingStore,
	useVaultStore,
} from "@cortex/core"
import { getPropertyValueList } from "@cortex/properties"
import {
	DATABASE_PRESETS,
	type DatabasePreset,
	type DatabaseViewType,
} from "@cortex/properties/database"
import { Host, Switch } from "@expo/ui"
import { router, Stack, useLocalSearchParams } from "expo-router"
import {
	BookOpen,
	Briefcase,
	Calendar,
	ChevronDown,
	CircleCheck,
	CircleDot,
	Folder,
	FolderOpen,
	Hash,
	type LucideIcon,
	Plus,
	SquareKanban,
	Table2,
	Type,
	User,
	Users,
	X,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { listTeamDatabasePresets } from "@/features/database/databaseAdapter"
import { DATABASE_VIEW_OPTIONS, firstName, noteCountLabel } from "@/features/database/databaseFormat"
import { readParam } from "@/features/database/databaseNavigation"
import {
	type FolderCandidate,
	type FolderScan,
	useFolderCandidates,
	useFolderScans,
} from "@/features/database/useFolderCandidates"
import { toast } from "@/features/feedback/useToast"
import { openDatabase } from "@/features/navigation/routes"
import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const UNTITLED = "Untitled database"
const PRESET_ICONS: Record<string, LucideIcon> = {
	contacts: Briefcase,
	empty: Plus,
	meetings: Users,
	projects: Table2,
	reading: BookOpen,
}
const TYPE_ICONS: Record<string, LucideIcon> = {
	date: Calendar,
	number: Hash,
	person: User,
	select: CircleDot,
}

type Choice =
	| { kind: "preset"; preset: DatabasePreset; team?: SharedDatabasePreset }
	| { kind: "folder"; folder: FolderCandidate }

interface PreviewTable {
	columns: { name: string; type: string }[]
	rows: { title: string; cells: string[] }[]
}

function presetPreview(preset: DatabasePreset, samples: boolean): PreviewTable {
	const columns = preset.properties.map((property) => ({ name: property.name, type: property.type }))
	const rows = samples
		? preset.samples.map((sample) => ({
				cells: preset.properties.map((property) => {
					const value = sample.values[property.key]
					return value === undefined ? "—" : String(value)
				}),
				title: sample.title,
			}))
		: []
	return { columns, rows }
}

function folderPreview(scan: FolderScan | undefined): PreviewTable {
	const keys = (scan?.keys ?? []).slice(0, 3)
	return {
		columns: keys.map((key) => ({ name: key, type: "text" })),
		rows: (scan?.samples ?? []).map((sample) => ({
			cells: keys.map((key) => {
				const values = getPropertyValueList(sample.meta[key]).map(String)
				return values.length ? values.join(", ") : "—"
			}),
			title: sample.title,
		})),
	}
}

function describeChoice(choice: Choice, title: string, scan: FolderScan | undefined) {
	if (choice.kind === "folder") {
		const properties = scan?.keys.length ?? 0
		return {
			done: `${choice.folder.name}/ is now a database — ${noteCountLabel(choice.folder.noteCount)}, ${properties} ${properties === 1 ? "property" : "properties"} found in their front matter`,
			hint: `Nothing moved: your notes stay where they are. A small view note, ${choice.folder.name}.md, holds the views and is hidden from the tree.`,
		}
	}
	const { preset, team } = choice
	if (preset.id === "empty" && !team) {
		return {
			done: "Empty database — add a property or just start writing rows",
			hint: `Each row is a note in ${title}/.`,
		}
	}
	const views = preset.views.length > 1 ? ` · ${preset.views.length} views` : ""
	const columns = preset.properties.map((property) => property.name).join(", ")
	return {
		done: `${preset.name}${team ? ` from ${team.groupName ?? "your team"}` : ""} — added ${columns}${views}`,
		hint: team
			? `Each row is a note in ${title}/. This is your copy — if ${firstName(team.ownerName)} updates the template, existing databases stay as they are.`
			: `Each row is a note in ${title}/. Change properties, views and sharing any time from the toolbar.`,
	}
}

async function submitChoice(
	choice: Choice,
	parentPath: string,
	name: string,
	samples: boolean,
): Promise<string | null> {
	try {
		if (choice.kind === "folder") {
			await convertFolderToDatabase(choice.folder.path)
			return choice.folder.path
		}
		const created = await createDatabase({
			name,
			parentPath,
			preset: choice.preset,
			samples: samples && choice.preset.samples.length > 0,
		})
		return created.folderPath
	} catch (error) {
		toast(getErrorMessage(error))
		return null
	}
}

function StartTile({
	Icon,
	colors,
	hint,
	name,
	onPress,
}: {
	Icon: LucideIcon
	colors: MobileColors
	hint: string
	name: string
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityHint={hint}
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.tile,
				{ backgroundColor: colors.cell, opacity: pressed && IS_IOS ? 0.7 : 1 },
			]}
		>
			<View style={[styles.tileIcon, { backgroundColor: colors.accentSubtle }]}>
				<Icon color={colors.tint} size={20} strokeWidth={2} />
			</View>
			<Text numberOfLines={1} style={[styles.tileName, { color: colors.label }]}>
				{name}
			</Text>
			<Text numberOfLines={2} style={[styles.tileHint, { color: colors.secondaryLabel }]}>
				{hint || " "}
			</Text>
		</Pressable>
	)
}

function PreviewGrid({ colors, table }: { colors: MobileColors; table: PreviewTable }) {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.preview}>
			<View>
				<View style={[styles.previewRow, { borderBottomColor: colors.separator }]}>
					<Text style={[styles.previewHead, styles.previewName, { color: colors.secondaryLabel }]}>
						Name
					</Text>
					{table.columns.map((column) => {
						const Icon = TYPE_ICONS[column.type] ?? Type
						return (
							<View key={column.name} style={[styles.previewCell, styles.previewHeadCell]}>
								<Icon color={colors.secondaryLabel} size={14} strokeWidth={2} />
								<Text numberOfLines={1} style={[styles.previewHead, { color: colors.secondaryLabel }]}>
									{column.name}
								</Text>
							</View>
						)
					})}
					<Text style={[styles.previewHead, styles.previewCell, { color: colors.tint }]}>+ Property</Text>
				</View>
				{table.rows.map((row) => (
					<View
						key={row.title}
						style={[
							styles.previewRow,
							{ backgroundColor: colors.accentSubtle, borderBottomColor: colors.separator },
						]}
					>
						<Text numberOfLines={1} style={[styles.previewText, styles.previewName, { color: colors.label }]}>
							{row.title}
						</Text>
						{row.cells.map((cell, index) => (
							<Text
								key={`${row.title}-${index}`}
								numberOfLines={1}
								style={[
									styles.previewText,
									styles.previewCell,
									{ color: cell === "—" ? colors.tertiaryLabel : colors.label },
								]}
							>
								{cell}
							</Text>
						))}
					</View>
				))}
				<View style={styles.previewRow}>
					<Text style={[styles.previewText, styles.previewName, { color: colors.tertiaryLabel }]}>
						+ New note
					</Text>
				</View>
			</View>
		</ScrollView>
	)
}

export function NewDatabaseScreen() {
	const params = useLocalSearchParams<{
		parentPath?: string | string[]
		start?: string | string[]
	}>()
	const { colors } = useMobileColors()
	const stackOptions = useStackScreenOptions()
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const sharedPresets = useTemplateSharingStore((state) => state.teamDatabasePresets)
	const teamPresets = useMemo(() => listTeamDatabasePresets(sharedPresets), [sharedPresets])
	const candidates = useFolderCandidates()
	const [name, setName] = useState("")
	const [parentPath, setParentPath] = useState(() => readParam(params.parentPath) ?? vault?.path ?? "")
	const [choice, setChoice] = useState<Choice | null>(null)
	const [samples, setSamples] = useState(true)
	const [foldersOpen, setFoldersOpen] = useState(() => readParam(params.start) === "folder")
	const [previewView, setPreviewView] = useState<DatabaseViewType>("table")
	const [busy, setBusy] = useState(false)
	const scans = useFolderScans(candidates, foldersOpen || choice?.kind === "folder")
	const vaultName = vault?.name ?? "Vault"
	const title = name.trim() || (choice?.kind === "preset" && choice.preset.id !== "empty" ? choice.preset.name : UNTITLED)
	const scan = choice?.kind === "folder" ? scans.get(choice.folder.path) : undefined
	const description = choice ? describeChoice(choice, title, scan) : null
	const parentLabel =
		vault && parentPath && parentPath !== vault.path
			? `${toVaultRelativePath(parentPath, vault.path) ?? getBaseName(parentPath)} / `
			: ""
	const locationLabel = `${vaultName} / ${choice?.kind === "folder" ? choice.folder.label : `${parentLabel}${title}`}`
	const previewViews =
		choice?.kind === "preset"
			? [...new Set(choice.preset.views.map((view) => view.type))]
			: (["table"] as DatabaseViewType[])
	const previewTable =
		choice?.kind === "preset"
			? presetPreview(choice.preset, samples)
			: choice?.kind === "folder"
				? folderPreview(scan)
				: null

	const locationGroups: MenuGroup[] = useMemo(() => {
		if (!vault) return []
		const folders = files
			.filter((file) => file.isDir && toVaultRelativePath(file.path, vault.path)?.split("/").length === 1)
			.slice(0, 12)
		return [
			[
				{
					checked: parentPath === vault.path,
					key: vault.path,
					label: vault.name,
					onPress: () => setParentPath(vault.path),
				},
				...folders.map((folder) => ({
					checked: parentPath === folder.path,
					key: folder.path,
					label: getBaseName(folder.path),
					onPress: () => setParentPath(folder.path),
				})),
			],
		]
	}, [files, parentPath, vault])

	function choosePreset(preset: DatabasePreset, team?: SharedDatabasePreset) {
		triggerSelectionHaptic()
		setChoice({ kind: "preset", preset, team })
		setPreviewView(preset.views[0]?.type ?? "table")
		if (!name.trim() && preset.id !== "empty") setName(preset.name)
	}

	function chooseFolder(folder: FolderCandidate) {
		triggerSelectionHaptic()
		setChoice({ folder, kind: "folder" })
		setFoldersOpen(false)
		setPreviewView("table")
		setName(folder.name)
	}

	function undo() {
		triggerSelectionHaptic()
		if (choice?.kind === "preset" && name === choice.preset.name) setName("")
		if (choice?.kind === "folder" && name === choice.folder.name) setName("")
		setChoice(null)
		setPreviewView("table")
	}

	async function finish() {
		if (!choice || busy || !parentPath) return
		setBusy(true)
		const folderPath = await submitChoice(choice, parentPath, title, samples)
		setBusy(false)
		if (!folderPath) return
		if (router.canGoBack()) router.back()
		openDatabase(folderPath, previewView)
	}

	function cancel() {
		if (router.canGoBack()) router.back()
	}

	return (
		<>
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				style={{ backgroundColor: colors.groupedBackground }}
			>
				<View style={styles.location}>
					{choice?.kind === "folder" ? (
						<Text style={[styles.locationText, { color: colors.secondaryLabel }]}>{locationLabel}</Text>
					) : (
						<NativeMenu
							accessibilityLabel={`Location: ${locationLabel}`}
							anchorStyle="plain"
							groups={locationGroups}
							title={`${locationLabel} ▾`}
						/>
					)}
				</View>
				<View style={styles.nameRow}>
					<Table2 color={colors.tint} size={28} strokeWidth={2} />
					<TextInput
						accessibilityLabel="Database name"
						editable={choice?.kind !== "folder"}
						onChangeText={setName}
						placeholder={UNTITLED}
						placeholderTextColor={colors.placeholder}
						returnKeyType="done"
						style={[styles.nameInput, { color: colors.label }]}
						value={name}
					/>
				</View>
				{choice && description ? (
					<>
						<View accessibilityRole="summary" style={[styles.card, { backgroundColor: colors.cell }]}>
							<View style={styles.cardLine}>
								<CircleCheck color={colors.successText} size={20} strokeWidth={2.2} />
								<Text style={[styles.cardText, { color: colors.label }]}>{description.done}</Text>
							</View>
							<View style={styles.cardActions}>
								{choice.kind === "preset" && choice.preset.samples.length > 0 ? (
									<View style={styles.samples}>
										<Text style={[styles.samplesLabel, { color: colors.label }]}>Sample notes</Text>
										<Host matchContents>
											<Switch label="Sample notes" onValueChange={setSamples} value={samples} />
										</Host>
									</View>
								) : (
									<View style={styles.samples} />
								)}
								<Pressable
									accessibilityRole="button"
									onPress={undo}
									style={({ pressed }) => [
										styles.undo,
										{ backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 },
									]}
								>
									<Text style={[styles.undoLabel, { color: colors.label }]}>Undo</Text>
								</Pressable>
							</View>
						</View>
						<Text style={[styles.footer, { color: colors.secondaryLabel }]}>{description.hint}</Text>
						<SegmentedControl
							accessibilityLabel="Views"
							onChange={setPreviewView}
							options={DATABASE_VIEW_OPTIONS.filter((option) => previewViews.includes(option.value))}
							style={styles.segmented}
							value={previewViews.includes(previewView) ? previewView : previewViews[0]}
						/>
						{previewTable ? <PreviewGrid colors={colors} table={previewTable} /> : null}
					</>
				) : (
					<>
						<GroupedSectionHeader>Start with</GroupedSectionHeader>
						<View style={styles.tiles}>
							{DATABASE_PRESETS.map((preset) => (
								<StartTile
									Icon={PRESET_ICONS[preset.id] ?? Table2}
									colors={colors}
									hint={preset.id === "empty" ? "No properties yet" : preset.hint}
									key={preset.id}
									name={preset.name}
									onPress={() => choosePreset(preset)}
								/>
							))}
						</View>
						{teamPresets.length > 0 ? (
							<>
								<View style={styles.teamHeader}>
									<Avatar name={teamPresets[0].groupName ?? "Team"} size={18} />
									<Text style={[styles.teamLabel, { color: colors.secondaryLabel }]}>
										{`From ${teamPresets[0].groupName ?? "your team"}`}
									</Text>
								</View>
								<View style={styles.tiles}>
									{teamPresets.map((shared) => (
										<StartTile
											Icon={SquareKanban}
											colors={colors}
											hint={`shared by ${firstName(shared.ownerName)}`}
											key={shared.shareId}
											name={shared.preset.name}
											onPress={() => choosePreset(shared.preset, shared)}
										/>
									))}
								</View>
							</>
						) : null}
						<View style={[styles.folders, { backgroundColor: colors.cell }]}>
							<Pressable
								accessibilityRole="button"
								accessibilityState={{ expanded: foldersOpen }}
								android_ripple={{ color: colors.hover }}
								onPress={() => {
									triggerSelectionHaptic()
									setFoldersOpen((current) => !current)
								}}
								style={styles.folderToggle}
							>
								<FolderOpen color={colors.tint} size={22} strokeWidth={2} />
								<Text style={[styles.folderToggleText, { color: colors.tint }]}>
									Or use notes you already have
								</Text>
								<ChevronDown
									color={colors.tint}
									size={18}
									strokeWidth={2.4}
									style={foldersOpen ? styles.chevronOpen : undefined}
								/>
							</Pressable>
							{foldersOpen
								? candidates.map((folder) => {
										const folderScan = scans.get(folder.path)
										const meta = folderScan
											? `${noteCountLabel(folder.noteCount)} · ${folderScan.keys.length} ${folderScan.keys.length === 1 ? "property" : "properties"} found`
											: noteCountLabel(folder.noteCount)
										return (
											<Pressable
												accessibilityRole="button"
												android_ripple={{ color: colors.hover }}
												key={folder.path}
												onPress={() => chooseFolder(folder)}
												style={[styles.folderRow, { borderTopColor: colors.separator }]}
											>
												<Folder color={colors.secondaryLabel} size={22} strokeWidth={2} />
												<View style={styles.folderBody}>
													<Text numberOfLines={1} style={[styles.folderName, { color: colors.label }]}>
														{`${folder.label}/`}
													</Text>
													<Text style={[styles.folderMeta, { color: colors.secondaryLabel }]}>{meta}</Text>
												</View>
											</Pressable>
										)
									})
								: null}
							{foldersOpen && candidates.length === 0 ? (
								<Text style={[styles.folderEmpty, { color: colors.secondaryLabel }]}>
									No folders with notes yet.
								</Text>
							) : null}
						</View>
					</>
				)}
			</ScrollView>
			<Stack.Screen
				options={{
					...stackOptions,
					headerLargeTitleEnabled: false,
					headerLeft: IS_IOS
						? undefined
						: () => <HeaderIconButton Icon={X} accessibilityLabel="Cancel" onPress={cancel} />,
					headerRight:
						IS_IOS || !choice
							? undefined
							: () => (
									<Pressable
										accessibilityRole="button"
										disabled={busy}
										hitSlop={8}
										onPress={() => void finish()}
										style={styles.androidDone}
									>
										<Text style={[styles.androidDoneLabel, { color: colors.tint }]}>Done</Text>
									</Pressable>
								),
					headerShown: true,
					title: "New database",
				}}
			/>
			{IS_IOS ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button onPress={cancel}>Cancel</Stack.Toolbar.Button>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Button
							disabled={busy}
							hidden={!choice}
							onPress={() => void finish()}
							variant="done"
						>
							Done
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				</>
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	androidDone: {
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	androidDoneLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	card: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		gap: 10,
		marginHorizontal: 16,
		marginTop: 14,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	cardActions: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
	},
	cardLine: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 10,
	},
	cardText: {
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
	},
	chevronOpen: {
		transform: [{ rotate: "180deg" }],
	},
	content: {
		paddingBottom: 48,
	},
	folderBody: {
		flex: 1,
		minWidth: 0,
	},
	folderEmpty: {
		fontSize: 15,
		lineHeight: 20,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	folderMeta: {
		fontSize: 13,
		lineHeight: 18,
	},
	folderName: {
		fontSize: 17,
		lineHeight: 22,
	},
	folderRow: {
		alignItems: "center",
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 14,
		minHeight: 56,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	folderToggle: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 52,
		paddingHorizontal: 16,
	},
	folderToggleText: {
		flex: 1,
		fontSize: 17,
		lineHeight: 22,
	},
	folders: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		marginTop: 18,
		overflow: "hidden",
	},
	footer: {
		fontSize: 13,
		lineHeight: 18,
		marginHorizontal: 32,
		marginTop: 8,
	},
	location: {
		alignItems: "flex-start",
		marginHorizontal: 16,
		marginTop: 6,
	},
	locationText: {
		fontSize: 13,
		lineHeight: 18,
		paddingHorizontal: 4,
		paddingVertical: 10,
	},
	nameInput: {
		flex: 1,
		fontSize: 30,
		fontWeight: "700",
		lineHeight: 38,
		minWidth: 0,
		padding: 0,
	},
	nameRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		paddingHorizontal: 20,
	},
	preview: {
		marginTop: 12,
	},
	previewCell: {
		paddingHorizontal: 8,
		width: 116,
	},
	previewHead: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	previewHeadCell: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
	},
	previewName: {
		paddingLeft: 20,
		paddingRight: 8,
		width: 172,
	},
	previewRow: {
		alignItems: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		height: 44,
	},
	previewText: {
		fontSize: 15,
		lineHeight: 20,
	},
	samples: {
		alignItems: "center",
		flex: 1,
		flexDirection: "row",
		gap: 10,
	},
	samplesLabel: {
		fontSize: 13,
		lineHeight: 18,
	},
	segmented: {
		marginHorizontal: 16,
		marginTop: 14,
	},
	teamHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		marginBottom: 6,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 20,
	},
	teamLabel: {
		fontSize: 13,
		lineHeight: 18,
	},
	tile: {
		borderCurve: "continuous",
		borderRadius: 22,
		gap: 8,
		overflow: "hidden",
		padding: 14,
		width: "48.5%",
	},
	tileHint: {
		fontSize: 13,
		lineHeight: 18,
	},
	tileIcon: {
		alignItems: "center",
		borderRadius: 10,
		height: 36,
		justifyContent: "center",
		width: 36,
	},
	tileName: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	tiles: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		justifyContent: "space-between",
		paddingHorizontal: 16,
	},
	undo: {
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 6,
	},
	undoLabel: {
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
	},
})
