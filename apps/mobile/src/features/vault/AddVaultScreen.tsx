import {
	ADD_VAULT_STEP_LABELS,
	type AddVaultPath,
	addVaultStepsFor,
	buildRemoteVaultOptions,
	CLOUD_SERVER_LABEL,
	getVaultInitial,
	NEW_REMOTE,
	type RemoteVaultOption,
	VAULT_COLORS,
} from "@cortex/core"
import { useLocalSearchParams } from "expo-router"
import { Check, CloudDownload, FolderOpen, Lock, Plus } from "lucide-react-native"
import { type ReactNode, useEffect, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openSettings } from "@/features/navigation/routes"
import {
	describeLocation,
	finishLocalVault,
	finishSyncedVault,
	pickParentFolder,
	pickVaultFolder,
} from "@/features/vault/addVaultActions"
import {
	type AddVaultState,
	createAddVaultState,
	isNewRemote,
	localVaultName,
	validatePassword,
} from "@/features/vault/addVaultState"
import { AddVaultStepper } from "@/features/vault/AddVaultStepper"
import { DEVICE_LABEL, useVaultListItems } from "@/features/vault/useVaultListItems"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"
import {
	getDefaultLocationLabel,
	getSelfHostedServerLabel,
	useDownloadProgress,
	useRemoteVaultChoices,
} from "@/features/vault/vaultSyncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const DEFAULT_LOCATION = IS_IOS ? "On My iPhone › Cortex" : "Documents › Cortex"

const START_VALUES = new Set(["choose", "create", "open", "download"])

interface ChooseOption {
	path: AddVaultPath
	title: string
	subtitle: string
	Icon: typeof Plus
}

const CHOOSE_OPTIONS: ChooseOption[] = [
	{ Icon: Plus, path: "create", subtitle: "Start with an empty folder", title: "Create a new vault" },
	{
		Icon: FolderOpen,
		path: "open",
		subtitle: `Use notes you already have on this ${DEVICE_LABEL}`,
		title: "Open a folder",
	},
	{
		Icon: CloudDownload,
		path: "download",
		subtitle: "Download one you or your team synced before",
		title: "Get a vault from your account",
	},
]

function useDefaultLocation(): string {
	const [label, setLabel] = useState(DEFAULT_LOCATION)
	useEffect(() => {
		let cancelled = false
		void getDefaultLocationLabel().then((next) => {
			if (!cancelled) setLabel(next)
		})
		return () => {
			cancelled = true
		}
	}, [])
	return label
}

function membersLabel(count: number | null): string {
	const members = count ?? 1
	return members === 1 ? "only you" : `${members} members`
}

function RadioMark({ selected }: { selected: boolean }) {
	const { colors } = useMobileColors()
	if (!selected) return <View style={[styles.radio, { borderColor: colors.tertiaryLabel }]} />
	return (
		<View style={[styles.radio, styles.radioOn, { backgroundColor: colors.tintFill, borderColor: colors.tintFill }]}>
			<Check color={colors.onTint} size={14} strokeWidth={3} />
		</View>
	)
}

function StepTitle({ lead, title }: { lead?: string; title: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.titleBlock}>
			<Text style={[styles.title, { color: colors.label }]}>{title}</Text>
			{lead ? <Text style={[styles.lead, { color: colors.secondaryLabel }]}>{lead}</Text> : null}
		</View>
	)
}

function VaultTile({ color, name }: { color: string; name: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.tile, { backgroundColor: color }]}>
			<Text style={[styles.tileText, { color: colors.onTint }]}>{getVaultInitial(name)}</Text>
		</View>
	)
}

function PrimaryButton({
	disabled,
	label,
	onPress,
}: {
	disabled?: boolean
	label: string
	onPress: () => void
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.primary,
				{ backgroundColor: colors.tintFill, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
			]}
		>
			<Text style={[styles.primaryLabel, { color: colors.onTint }]}>{label}</Text>
		</Pressable>
	)
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
	const { colors } = useMobileColors()
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
			<Text style={[styles.textButtonLabel, { color: colors.tint }]}>{label}</Text>
		</Pressable>
	)
}

function LockedBanner({ onSelfHosted }: { onSelfHosted: () => void }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.banner, { backgroundColor: colors.warningBackground }]}>
			<View style={styles.bannerHead}>
				<Lock color={colors.warningText} size={18} strokeWidth={2.2} />
				<Text style={[styles.bannerTitle, { color: colors.warningText }]}>
					Syncing with Cortex Cloud needs Hosted Sync
				</Text>
			</View>
			<Text style={[styles.bannerBody, { color: colors.label }]}>
				Your vaults are safe and listed below. Pick a plan to use them, or connect your own server.
			</Text>
			<View style={styles.bannerActions}>
				<TextButton
					label="See plans"
					onPress={() => {
						dismissSheet()
						openSettings("plan")
					}}
				/>
				<TextButton label="Use a self-hosted server" onPress={onSelfHosted} />
			</View>
		</View>
	)
}

export function AddVaultScreen() {
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ start?: string; remoteVaultId?: string }>()
	const [state, setState] = useState<AddVaultState>(() =>
		createAddVaultState(
			START_VALUES.has(params.start ?? "") ? (params.start as AddVaultPath | "choose") : "choose",
			params.remoteVaultId ?? null,
		),
	)
	const patch = (next: Partial<AddVaultState>) => setState((current) => ({ ...current, ...next }))
	const { items } = useVaultListItems()
	const { openVault } = useVaultSwitcher()
	const { locked: planLocked } = useHostedSyncEntitlement()
	const defaultLocation = useDefaultLocation()
	const choices = useRemoteVaultChoices(state.server)
	const progress = useDownloadProgress(state.step === "done" && state.path === "download")

	const { path, step } = state
	const syncing = path === "download" || state.mode === "sync"
	const steps = path ? addVaultStepsFor(path, syncing) : []
	const stepIndex = steps.indexOf(step)
	const stepLabel = step === "choose" ? null : ADD_VAULT_STEP_LABELS[step]
	const locked = planLocked && state.server === "cloud"
	const serverName = state.server === "cloud" ? CLOUD_SERVER_LABEL : getSelfHostedServerLabel()
	const options: RemoteVaultOption[] = buildRemoteVaultOptions(choices, items, DEVICE_LABEL)
	const selected = options.find((option) => option.remote.id === state.remoteId)
	const name = localVaultName(state)
	const isNew = isNewRemote(state)
	const finalName = name || selected?.remote.name || state.remoteName
	const remoteLabel = state.remoteName || selected?.remote.name || state.newRemoteName

	const close = () => dismissSheet()
	const go = (nextStep: AddVaultState["step"]) => patch({ error: null, step: nextStep })
	const canGoBack = step !== "choose" && step !== "done" && (stepIndex > 0 || params.start === undefined || params.start === "choose")
	const back = () => {
		if (stepIndex > 0) go(steps[stepIndex - 1] ?? "choose")
		else patch({ error: null, path: null, remoteId: null, step: "choose" })
	}

	const choosePath = (nextPath: AddVaultPath) => {
		const first = addVaultStepsFor(nextPath, nextPath === "download")[0] ?? "choose"
		patch({ error: null, mode: nextPath === "download" ? "sync" : null, path: nextPath, remoteId: null, step: first })
		if (nextPath === "open") void pickFolder()
	}

	async function pickFolder() {
		const result = await pickVaultFolder(patch)
		if (result.kind !== "existing") return
		close()
		toast(`Opening ${result.entry.name}…`)
		await openVault(result.entry)
	}

	async function openCreatedVault() {
		if (!state.entry) return
		close()
		toast(`Opening ${finalName}…`)
		await openVault(state.entry)
	}

	const submitPassword = () => {
		const error = validatePassword(state)
		if (error) {
			patch({ error })
			return
		}
		void finishSyncedVault(state, patch)
	}

	let body: ReactNode = null
	let primary: { label: string; disabled?: boolean; onPress: () => void } | null = null
	let alt: { label: string; onPress: () => void } | null = null

	if (step === "choose") {
		body = (
			<>
				<StepTitle
					lead={`A vault is a folder of Markdown notes on this ${DEVICE_LABEL}. Syncing is optional and can be added later.`}
					title="Add a vault"
				/>
				<GroupedList>
					{CHOOSE_OPTIONS.map((option) => (
						<GroupedRow
							chevron
							key={option.path}
							leading={<option.Icon color={colors.tint} size={22} strokeWidth={2} />}
							onPress={() => choosePath(option.path)}
							subtitle={option.subtitle}
							title={option.title}
						/>
					))}
				</GroupedList>
			</>
		)
	}

	if (step === "name") {
		body = (
			<>
				<StepTitle lead="Cortex creates the folder for you." title="New vault" />
				<View style={styles.nameRow}>
					<VaultTile color={state.color} name={state.name || "V"} />
					<View style={styles.nameField}>
						<MobileTextField
							accessibilityLabel="Vault name"
							autoFocus
							onChangeText={(value) => patch({ name: value })}
							placeholder="Vault name"
							value={state.name}
						/>
					</View>
				</View>
				<GroupedSectionHeader>Color</GroupedSectionHeader>
				<View style={[styles.swatches, { backgroundColor: colors.cell }]}>
					{VAULT_COLORS.map((color) => (
						<Pressable
							accessibilityLabel={color}
							accessibilityRole="radio"
							accessibilityState={{ selected: color === state.color }}
							key={color}
							onPress={() => patch({ color })}
							style={[styles.swatchRing, { borderColor: color === state.color ? colors.tint : "transparent" }]}
						>
							<View style={[styles.swatch, { backgroundColor: color }]} />
						</Pressable>
					))}
				</View>
				<GroupedSectionHeader>Folder</GroupedSectionHeader>
				<GroupedList>
					<GroupedRow
						onPress={() => void pickParentFolder(patch)}
						title={describeLocation(state, defaultLocation)}
						trailing={<Text style={[styles.change, { color: colors.tint }]}>Change…</Text>}
					/>
				</GroupedList>
			</>
		)
		primary = { disabled: !state.name.trim(), label: "Next: sync", onPress: () => go("sync") }
	}

	if (step === "folder") {
		const folder = state.folder
		body = (
			<>
				<StepTitle lead="Pick a folder with notes, or an empty one." title="Open a folder as a vault" />
				<GroupedSectionHeader>Files</GroupedSectionHeader>
				<GroupedList>
					{folder ? (
						<GroupedRow
							leading={<FolderOpen color={colors.tint} size={22} strokeWidth={2} />}
							subtitle={
								folder.noteCount === null
									? "Counting notes…"
									: folder.noteCount === 0
										? "No notes yet"
										: `${folder.noteCount} notes`
							}
							title={folder.name}
							trailing={<RadioMark selected />}
						/>
					) : null}
					<GroupedRow
						disabled={state.busy}
						onPress={() => void pickFolder()}
						tint
						title={folder ? "Choose another folder…" : "Choose a folder…"}
					/>
				</GroupedList>
				{folder && folder.noteCount !== null ? (
					<GroupedFooter>
						{folder.noteCount === 0
							? "No Markdown notes yet. It opens as an empty vault."
							: `${folder.name} has ${folder.noteCount} Markdown notes. They stay where they are; Cortex adds a small .cortex folder.`}
					</GroupedFooter>
				) : null}
			</>
		)
		primary = { disabled: !folder || state.busy, label: "Next: sync", onPress: () => go("sync") }
	}

	if (step === "sync") {
		body = (
			<>
				<StepTitle
					lead="Syncing links this folder to a remote vault so your other devices get the same notes."
					title={`Sync ${name}?`}
				/>
				<GroupedList>
					<GroupedRow
						onPress={() => patch({ mode: "keep" })}
						subtitle="Plain files. You can turn on sync any time."
						title={`Keep it on this ${DEVICE_LABEL}`}
						trailing={<RadioMark selected={state.mode === "keep"} />}
					/>
					<GroupedRow
						onPress={() => patch({ mode: "sync" })}
						subtitle="Link to a vault in your account, or create one"
						title="Sync it"
						trailing={
							<View style={styles.inline}>
								{planLocked ? <Badge label="Needs a plan" /> : null}
								<RadioMark selected={state.mode === "sync"} />
							</View>
						}
					/>
				</GroupedList>
			</>
		)
		primary =
			state.mode === "sync"
				? { label: "Next: choose remote vault", onPress: () => go("remote") }
				: {
						disabled: state.mode === null || state.busy,
						label: path === "open" ? "Open as vault" : "Create vault",
						onPress: () => void finishLocalVault(state, patch),
					}
	}

	if (step === "remote") {
		const isDownload = path === "download"
		body = (
			<>
				<StepTitle
					lead={
						isDownload
							? `These are in your account but not on this ${DEVICE_LABEL}.`
							: "Pick one you already have, or create a new one."
					}
					title={isDownload ? `Which vault do you want on this ${DEVICE_LABEL}?` : "Sync with which remote vault?"}
				/>
				{locked ? <LockedBanner onSelfHosted={() => patch({ remoteId: null, server: "selfHosted" })} /> : null}
				<GroupedSectionHeader
					trailing={
						<Text
							onPress={() =>
								patch({ remoteId: null, server: state.server === "cloud" ? "selfHosted" : "cloud" })
							}
							style={[styles.headerLink, { color: colors.tint }]}
						>
							{state.server === "cloud" ? "Use a self-hosted server" : "Use Cortex Cloud"}
						</Text>
					}
				>
					{`Vaults on ${serverName}`}
				</GroupedSectionHeader>
				<GroupedList>
					{options.map((option) => (
						<GroupedRow
							disabled={locked || option.takenBy !== null}
							key={option.remote.id}
							onPress={() => patch({ remoteId: option.remote.id, remoteName: option.remote.name })}
							subtitle={
								option.takenBy || state.server === "cloud"
									? option.description
									: `${serverName} · ${membersLabel(option.remote.memberCount)}`
							}
							title={option.remote.name}
							trailing={<RadioMark selected={state.remoteId === option.remote.id} />}
						/>
					))}
					{!isDownload ? (
						<GroupedRow
							disabled={locked}
							onPress={() =>
								patch({ newRemoteName: state.newRemoteName || name, remoteId: NEW_REMOTE, remoteName: "" })
							}
							subtitle={`Upload this vault to ${serverName}`}
							title="Create a new remote vault"
							trailing={<RadioMark selected={isNew} />}
						/>
					) : null}
				</GroupedList>
				{isNew ? (
					<View style={styles.field}>
						<MobileTextField
							label="Remote name"
							onChangeText={(value) => patch({ newRemoteName: value })}
							value={state.newRemoteName}
						/>
					</View>
				) : null}
			</>
		)
		primary = {
			disabled: locked || !state.remoteId || (isNew && !state.newRemoteName.trim()),
			label: isDownload ? "Next: choose folder" : "Next: password",
			onPress: () => go(isDownload ? "location" : "password"),
		}
		if (!isDownload) {
			alt = {
				label: `Keep on this ${DEVICE_LABEL} instead`,
				onPress: () => void finishLocalVault(state, patch),
			}
		}
	}

	if (step === "location") {
		body = (
			<>
				<StepTitle lead="Cortex makes a local folder for it." title="Where should it live?" />
				<GroupedList>
					<GroupedRow
						onPress={() => void pickParentFolder(patch)}
						subtitle={describeLocation(state, defaultLocation)}
						title={`Save “${remoteLabel}” in`}
						trailing={<Text style={[styles.change, { color: colors.tint }]}>Change…</Text>}
					/>
				</GroupedList>
				<GroupedFooter>
					Cortex creates this folder, downloads the notes into it and keeps it in sync.
				</GroupedFooter>
			</>
		)
		primary = { label: "Next: password", onPress: () => go("password") }
	}

	if (step === "password") {
		const target = isNew ? state.newRemoteName.trim() || name : remoteLabel
		body = (
			<>
				<StepTitle
					lead={
						isNew
							? "Notes are encrypted with this password. You'll need it on every device."
							: `Use the password set when ${target} was created.`
					}
					title={isNew ? `Protect ${target}` : `Unlock ${target}`}
				/>
				<View style={styles.field}>
					<MobileTextField
						autoFocus
						label="Password"
						onChangeText={(value) => patch({ error: null, password: value })}
						secureTextEntry
						textContentType={isNew ? "newPassword" : "password"}
						value={state.password}
					/>
					{isNew ? (
						<MobileTextField
							label="Confirm"
							onChangeText={(value) => patch({ confirm: value, error: null })}
							secureTextEntry
							textContentType="newPassword"
							value={state.confirm}
						/>
					) : null}
				</View>
				<GroupedFooter>
					{isNew ? "Keep it somewhere safe." : "Ask the owner if you don't have it."}
				</GroupedFooter>
			</>
		)
		primary = {
			disabled: state.busy,
			label: isNew ? "Create & sync" : path === "download" ? "Unlock & download" : "Unlock & sync",
			onPress: submitPassword,
		}
	}

	if (step === "done") {
		const isDownload = path === "download"
		const synced = state.mode !== "keep"
		const location = state.entry?.displayPath ?? state.entry?.path ?? describeLocation(state, defaultLocation)
		body = (
			<>
				<StepTitle
					lead="Here's what was set up."
					title={isDownload ? `${finalName} is on its way` : `${finalName} is ready`}
				/>
				<View style={[styles.summary, { backgroundColor: colors.cell }]}>
					<VaultTile color={path === "create" ? state.color : colors.tintFill} name={finalName} />
					<View style={styles.summaryText}>
						<Text style={[styles.summaryName, { color: colors.label }]}>{finalName}</Text>
						<Text style={[styles.summaryLine, { color: colors.secondaryLabel }]}>
							{synced ? `Syncs with ${serverName}` : `Only on this ${DEVICE_LABEL}`}
						</Text>
					</View>
				</View>
				<GroupedList>
					<GroupedRow subtitle={location} title="Folder" />
					<GroupedRow
						title="Sync"
						value={synced ? `With “${remoteLabel}” on ${serverName}` : `Only on this ${DEVICE_LABEL}`}
					/>
					<GroupedRow title="Encryption" value={synced ? "On" : "—"} />
				</GroupedList>
				{isDownload ? (
					<View style={styles.progressBlock}>
						<View style={[styles.track, { backgroundColor: colors.fill2 }]}>
							<View
								style={[styles.fill, { backgroundColor: colors.tintFill, width: `${Math.round(progress * 100)}%` }]}
							/>
						</View>
						<Text style={[styles.progressText, { color: colors.secondaryLabel }]}>
							{`${Math.round(progress * 100)}% · Downloading notes. You can open it now; the rest arrives in the background.`}
						</Text>
					</View>
				) : null}
			</>
		)
		primary = { label: `Open ${finalName}`, onPress: () => void openCreatedVault() }
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<AddVaultStepper
				canGoBack={canGoBack}
				index={Math.max(stepIndex, 0)}
				label={stepLabel}
				onBack={back}
				onClose={close}
				total={steps.length}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				style={styles.scroll}
			>
				{body}
				{state.error ? (
					<Text style={[styles.error, { color: colors.destructiveText }]}>{state.error}</Text>
				) : null}
			</ScrollView>
			{primary || alt ? (
				<View style={[styles.footer, { borderTopColor: colors.separator }]}>
					{primary ? (
						<PrimaryButton disabled={primary.disabled} label={primary.label} onPress={primary.onPress} />
					) : null}
					{alt ? <TextButton label={alt.label} onPress={alt.onPress} /> : null}
				</View>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	banner: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 18 : 16,
		gap: 6,
		marginHorizontal: 16,
		marginTop: 12,
		padding: 14,
	},
	bannerActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 4,
		marginLeft: -12,
	},
	bannerBody: {
		fontSize: 14,
		lineHeight: 19,
	},
	bannerHead: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
	bannerTitle: {
		flex: 1,
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	change: {
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
	},
	content: {
		paddingBottom: 32,
	},
	error: {
		fontSize: 13,
		lineHeight: 18,
		marginHorizontal: 32,
		marginTop: 10,
	},
	field: {
		gap: 12,
		marginHorizontal: 16,
		marginTop: 12,
	},
	fill: {
		borderRadius: 999,
		height: "100%",
	},
	footer: {
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 4,
		paddingBottom: IS_IOS ? 28 : 16,
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	headerLink: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	inline: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
	lead: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	nameField: {
		flex: 1,
	},
	nameRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		marginHorizontal: 16,
	},
	primary: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 50 : 48,
		justifyContent: "center",
	},
	primaryLabel: {
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: "600",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: 22,
	},
	progressBlock: {
		gap: 8,
		marginHorizontal: 20,
		marginTop: 16,
	},
	progressText: {
		fontSize: 13,
		lineHeight: 18,
	},
	radio: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		height: 22,
		justifyContent: "center",
		width: 22,
	},
	radioOn: {
		borderWidth: 0,
	},
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	summary: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		gap: 14,
		marginBottom: 12,
		marginHorizontal: 16,
		padding: 16,
	},
	summaryLine: {
		fontSize: 13,
		lineHeight: 18,
	},
	summaryName: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	summaryText: {
		flex: 1,
		gap: 2,
	},
	swatch: {
		borderRadius: 999,
		height: 28,
		width: 28,
	},
	swatchRing: {
		borderRadius: 999,
		borderWidth: 2.5,
		padding: 2,
	},
	swatches: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		marginHorizontal: 16,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	textButton: {
		alignItems: "center",
		borderRadius: 999,
		justifyContent: "center",
		minHeight: 44,
		paddingHorizontal: 12,
	},
	textButtonLabel: {
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: "500",
		lineHeight: 22,
	},
	tile: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 14,
		height: 52,
		justifyContent: "center",
		width: 52,
	},
	tileText: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 28,
	},
	title: {
		fontSize: IS_IOS ? 28 : 24,
		fontWeight: IS_IOS ? "700" : "400",
		lineHeight: IS_IOS ? 34 : 32,
	},
	titleBlock: {
		gap: 6,
		marginBottom: 16,
		marginHorizontal: 20,
		marginTop: 8,
	},
	track: {
		borderRadius: 999,
		height: 6,
		overflow: "hidden",
	},
})
