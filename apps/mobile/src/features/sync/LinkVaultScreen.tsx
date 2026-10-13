import {
	formatLastSyncedAt,
	useDevicesStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { BottomSheet, FieldGroup, Text as NativeText } from "@expo/ui"
import { Check, Cloud, CloudOff, Plus } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { openSettings } from "@/features/navigation/routes"
import {
	ActionButton,
	SettingsCard,
	SettingsFooterText,
	SettingsGroup,
	SettingsPage,
} from "@/features/sync/SettingsPage"
import {
	getRemoteVaultLinkOptions,
	linkRemoteVault,
	listSyncDevices,
	resolveLinkedRemoteVault,
	unlinkRemoteVault,
} from "@/features/sync/syncAdapter"
import { DEVICE_LABEL, type RemoteVaultLinkOption } from "@/features/sync/syncFixtures"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const SHEET_SNAP_POINTS = IS_IOS ? (["full"] as const) : undefined
const FIRST_SYNC_PROGRESS = 0.3
const STEPS = ["pick", "password", "done"] as const

type LinkStep = (typeof STEPS)[number]

interface LinkSheetState {
	step: LinkStep
	pickId: string
	newName: string
	password: string
	confirm: string
	error: string | null
	linkedName: string | null
}

function createSheetState(defaultPick: string, newName: string): LinkSheetState {
	return {
		step: "pick",
		pickId: defaultPick,
		newName,
		password: "",
		confirm: "",
		error: null,
		linkedName: null,
	}
}

function StepIndicator({ step }: { step: LinkStep }) {
	const { colors } = useMobileColors()
	const activeIndex = STEPS.indexOf(step)
	const label =
		step === "pick" ? "Step 1 of 2 · Remote vault" : step === "password" ? "Step 2 of 2 · Password" : ""
	if (!label) return null
	return (
		<View style={styles.stepRow}>
			<Text style={[styles.stepText, { color: colors.secondaryLabel }]}>{label}</Text>
			<View style={styles.dots}>
				{STEPS.slice(0, 2).map((name, index) => (
					<View
						key={name}
						style={[
							styles.dot,
							{ backgroundColor: index <= activeIndex ? colors.tintFill : colors.fill2 },
						]}
					/>
				))}
			</View>
		</View>
	)
}

function RadioOption({
	option,
	selected,
	onPick,
}: {
	option: RemoteVaultLinkOption
	selected: boolean
	onPick: () => void
}) {
	const { colors } = useMobileColors()
	const Icon = option.isNew ? Plus : Cloud
	return (
		<GroupedRow
			accessibilityLabel={option.name}
			disabled={option.taken}
			leading={<Icon color={colors.secondaryLabel} size={22} strokeWidth={2} />}
			onPress={onPick}
			subtitle={option.description}
			title={option.name}
			trailing={
				<View
					style={[
						styles.radio,
						{
							backgroundColor: selected ? colors.tintFill : "transparent",
							borderColor: selected ? colors.tintFill : colors.tertiaryLabel,
						},
					]}
				>
					{selected ? <Check color={colors.onTint} size={14} strokeWidth={3} /> : null}
				</View>
			}
		/>
	)
}

export function LinkVaultScreen() {
	const { colors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSyncEnabled = useRemoteVaultStore((state) => state.setSyncEnabled)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const deviceEntries = useDevicesStore((state) => state.deviceEntries)
	const [sheet, setSheet] = useState<LinkSheetState | null>(null)
	const [unlinkOpen, setUnlinkOpen] = useState(false)

	const vaultName = vault?.name ?? "Notes"
	const vaultPath = vault?.path ?? null
	const linked = resolveLinkedRemoteVault(remoteVaults, linkedVaultId, syncConfig)
	const enabled = syncConfig.enabled
	const options = getRemoteVaultLinkOptions(remoteVaults, linkedVaultId, vaultName)
	const devices = listSyncDevices(deviceEntries, lastSyncedAt)
	const lastSynced = enabled ? formatLastSyncedAt(lastSyncedAt) : "Paused"

	const openSheet = () => {
		const defaultPick =
			options.find((option) => !option.taken && !option.isNew)?.id ?? options[0]?.id ?? "new"
		setSheet(createSheetState(defaultPick, vaultName))
	}

	const picked = sheet ? options.find((option) => option.id === sheet.pickId) : undefined
	const creating = Boolean(picked && (picked.isNew || !picked.encrypted))
	const targetName = picked
		? picked.isNew
			? sheet?.newName.trim() || "Notes"
			: picked.name
		: ""
	const pickLocked = Boolean(picked?.isNew && !sheet?.newName.trim())
	const mismatch = sheet?.error === "Passwords do not match"

	const submitLink = () => {
		if (!sheet || !picked || !vaultPath) return
		if (creating) {
			if (sheet.password.length < 8) {
				setSheet({ ...sheet, error: "Password must be at least 8 characters" })
				return
			}
			if (sheet.password !== sheet.confirm) {
				setSheet({ ...sheet, error: "Passwords do not match" })
				return
			}
		} else if (!sheet.password) {
			setSheet({ ...sheet, error: "Enter the password" })
			return
		}
		void linkRemoteVault(vaultPath, picked, sheet.newName).then(() =>
			setSheet((current) =>
				current ? { ...current, step: "done", error: null, linkedName: targetName } : current,
			),
		)
	}

	const confirmUnlink = () => {
		setUnlinkOpen(false)
		if (vaultPath) void unlinkRemoteVault(vaultPath)
	}

	const sheetTitle =
		sheet?.step === "done" ? "Linked" : linked ? "Change remote vault" : `Sync "${vaultName}"`
	const sheetLead =
		sheet?.step === "pick"
			? "Pick the remote vault this one syncs with."
			: sheet?.step === "password"
				? creating
					? `Create an encryption password for ${targetName}.`
					: `${targetName} is encrypted.`
				: "You can change or stop this from Settings → Sync."

	return (
		<>
			<SettingsPage subtitle={`Keep "${vaultName}" the same on every device.`}>
				{linked ? (
					<>
						<SettingsGroup>
							<FieldGroup.Section>
								<SettingsRow
									onToggle={(value) => {
										if (vaultPath) void setSyncEnabled(vaultPath, value)
									}}
									subtitle="Pause without unlinking the remote vault."
									title="Sync this vault"
									toggled={enabled}
								/>
							</FieldGroup.Section>
							<FieldGroup.Section title="Remote vault">
								<SettingsRow
									chevron
									Icon={Cloud}
									onPress={openSheet}
									subtitle={`${linked.serverLabel} · ${linked.role} · ${enabled ? `Synced ${formatLastSyncedAt(lastSyncedAt).toLowerCase()}` : "Paused"}`}
									title={linked.name}
									value="Change…"
								/>
								<SettingsRow title="Last synced" value={lastSynced} />
								<SettingsRow
									title="Connected devices"
									value={`${devices.length} ${devices.length === 1 ? "device" : "devices"}`}
								/>
							</FieldGroup.Section>
							<FieldGroup.Section>
								<SettingsRow
									destructive
									Icon={CloudOff}
									onPress={() => setUnlinkOpen(true)}
									subtitle={
										IS_IOS
											? undefined
											: `Notes stay on this ${DEVICE_LABEL}. ${linked.name} isn't touched.`
									}
									title="Stop syncing…"
								/>
								{IS_IOS ? (
									<FieldGroup.SectionFooter>
										<NativeText textStyle={{ color: colors.secondaryLabel }}>
											{`Notes stay on this ${DEVICE_LABEL}. ${linked.name} isn't touched.`}
										</NativeText>
									</FieldGroup.SectionFooter>
								) : null}
							</FieldGroup.Section>
						</SettingsGroup>
					</>
				) : (
					<View style={styles.cardWrap}>
						<SettingsCard>
							<View style={styles.cardHead}>
								<CloudOff color={colors.secondaryLabel} size={28} strokeWidth={2} />
								<View style={styles.cardText}>
									<Text style={[styles.cardTitle, { color: colors.label }]}>
										{`Only on this ${DEVICE_LABEL}`}
									</Text>
									<Text style={[styles.cardSubtitle, { color: colors.secondaryLabel }]}>
										Link a remote vault to sync it, or create a new one.
									</Text>
								</View>
							</View>
							<View style={styles.cardAction}>
								<ActionButton label="Link vault…" onPress={openSheet} wide />
							</View>
						</SettingsCard>
					</View>
				)}
			</SettingsPage>

			<BottomSheet
				containerColor={colors.groupedBackground}
				contentPadding={0}
				isPresented={sheet !== null}
				onDismiss={() => setSheet(null)}
				snapPoints={SHEET_SNAP_POINTS ? [...SHEET_SNAP_POINTS] : undefined}
			>
				{sheet ? (
					<View style={[styles.sheet, { backgroundColor: colors.groupedBackground }]}>
						<SheetHeader onClose={() => setSheet(null)} title={sheetTitle} />
						<ScrollView
							contentContainerStyle={styles.sheetContent}
							keyboardDismissMode="on-drag"
							keyboardShouldPersistTaps="handled"
						>
							<StepIndicator step={sheet.step} />
							<Text style={[styles.lead, { color: colors.label }]}>{sheetLead}</Text>

							{sheet.step === "pick" ? (
								<>
									<GroupedSectionHeader
										trailing={
											<Pressable
												accessibilityRole="button"
												hitSlop={6}
												onPress={() => {
													setSheet(null)
													openSettings("sync/self-hosted")
												}}
											>
												<Text style={[styles.headerLink, { color: colors.tint }]}>
													Use a self-hosted server
												</Text>
											</Pressable>
										}
									>
										On Cortex Cloud
									</GroupedSectionHeader>
									<GroupedList>
										{options.map((option) => (
											<RadioOption
												key={option.id}
												onPick={() => setSheet({ ...sheet, pickId: option.id })}
												option={option}
												selected={sheet.pickId === option.id}
											/>
										))}
									</GroupedList>
									{picked?.isNew ? (
										<View style={styles.field}>
											<MobileTextField
												label="Name"
												onChangeText={(value) => setSheet({ ...sheet, newName: value })}
												placeholder="Notes"
												value={sheet.newName}
											/>
										</View>
									) : null}
									<View style={styles.cta}>
										<ActionButton
											disabled={pickLocked || !picked}
											label="Continue"
											onPress={() =>
												setSheet({ ...sheet, step: "password", password: "", confirm: "", error: null })
											}
											wide
										/>
									</View>
								</>
							) : null}

							{sheet.step === "password" ? (
								<>
									<View style={styles.field}>
										<MobileTextField
											autoCapitalize="none"
											autoFocus
											error={mismatch ? null : sheet.error}
											label={IS_IOS ? "Password" : "Encryption password"}
											onChangeText={(value) => setSheet({ ...sheet, password: value, error: null })}
											placeholder="Password"
											secureTextEntry
											value={sheet.password}
										/>
										{creating ? (
											<MobileTextField
												autoCapitalize="none"
												error={mismatch ? sheet.error : null}
												label={IS_IOS ? "Confirm" : "Confirm password"}
												onChangeText={(value) => setSheet({ ...sheet, confirm: value, error: null })}
												placeholder="Confirm password"
												secureTextEntry
												value={sheet.confirm}
											/>
										) : null}
									</View>
									<SettingsFooterText>
										{creating
											? "Cortex uses it to encrypt this vault. You'll need it on every device."
											: `The one set when ${targetName} was created. Ask the owner if you don't have it.`}
									</SettingsFooterText>
									<View style={styles.cta}>
										<ActionButton
											label={creating ? "Create & link" : "Unlock & link"}
											onPress={submitLink}
											wide
										/>
										<ActionButton
											label="Back"
											onPress={() => setSheet({ ...sheet, step: "pick", error: null })}
											variant="text"
											wide
										/>
									</View>
								</>
							) : null}

							{sheet.step === "done" ? (
								<View style={styles.done}>
									<View style={[styles.doneIcon, { backgroundColor: colors.successBackground }]}>
										<Check color={colors.successText} size={28} strokeWidth={2.6} />
									</View>
									<Text style={[styles.doneTitle, { color: colors.label }]}>
										{`${vaultName} syncs with ${sheet.linkedName ?? targetName}`}
									</Text>
									<Text style={[styles.doneSubtitle, { color: colors.secondaryLabel }]}>
										First sync running. You can keep writing.
									</Text>
									<View style={[styles.progressTrack, { backgroundColor: colors.fill }]}>
										<View
											style={[
												styles.progressFill,
												{ backgroundColor: colors.tintFill, width: `${FIRST_SYNC_PROGRESS * 100}%` },
											]}
										/>
									</View>
									<View style={styles.cta}>
										<ActionButton label="Done" onPress={() => setSheet(null)} wide />
									</View>
								</View>
							) : null}
						</ScrollView>
					</View>
				) : null}
			</BottomSheet>

			<ConfirmDialog
				confirmLabel="Stop syncing"
				destructive
				impact={[
					{ label: IS_IOS ? "This iPhone" : "This phone", value: "Becomes local only" },
					{ label: linked?.serverLabel ?? "Cortex Cloud", value: `${linked?.name ?? "Remote"} stays as is` },
					{ label: "Other devices", value: "Keep syncing" },
				]}
				message={`This ${DEVICE_LABEL} keeps every note as a local vault. Link it again any time.`}
				onCancel={() => setUnlinkOpen(false)}
				onConfirm={confirmUnlink}
				title={`Stop syncing ${vaultName}?`}
				visible={unlinkOpen}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	cardAction: {
		marginTop: 14,
	},
	cardHead: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
	},
	cardSubtitle: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: 2,
	},
	cardText: {
		flex: 1,
		minWidth: 0,
	},
	cardTitle: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	cardWrap: {
		marginTop: 12,
	},
	cta: {
		gap: 8,
		marginHorizontal: 16,
		marginTop: 20,
	},
	done: {
		alignItems: "center",
		gap: 8,
		paddingTop: 12,
	},
	doneIcon: {
		alignItems: "center",
		borderRadius: 999,
		height: 56,
		justifyContent: "center",
		width: 56,
	},
	doneSubtitle: {
		fontSize: 14,
		lineHeight: 20,
		textAlign: "center",
	},
	doneTitle: {
		fontSize: 20,
		fontWeight: "600",
		lineHeight: 26,
		marginTop: 8,
		textAlign: "center",
	},
	dot: {
		borderRadius: 999,
		height: 6,
		width: 18,
	},
	dots: {
		flexDirection: "row",
		gap: 4,
	},
	field: {
		gap: 12,
		marginHorizontal: 16,
		marginTop: 16,
	},
	headerLink: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
	lead: {
		fontSize: 15,
		lineHeight: 20,
		marginHorizontal: 20,
		marginTop: 8,
	},
	progressFill: {
		borderRadius: 999,
		height: "100%",
	},
	progressTrack: {
		borderRadius: 999,
		height: 6,
		marginHorizontal: 32,
		marginTop: 12,
		overflow: "hidden",
		width: "70%",
	},
	radio: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		height: 22,
		justifyContent: "center",
		width: 22,
	},
	sheet: {
		minHeight: 320,
		width: "100%",
	},
	sheetContent: {
		paddingBottom: 40,
	},
	stepRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		marginHorizontal: 20,
	},
	stepText: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
})
