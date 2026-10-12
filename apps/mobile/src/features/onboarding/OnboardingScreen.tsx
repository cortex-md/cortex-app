import {
	createDefaultSyncPreferences,
	createVaultFromFolder,
	DEFAULT_VAULT_NAME,
	getDefaultVaultName,
	getErrorMessage,
	getRegistryOpenOptions,
	openVaultSession,
	resolvePickedFolder,
	useAppStore,
	useVaultStore,
} from "@cortex/core"
import type { SyncPreferences, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useRouter } from "expo-router"
import { BookOpen, Folder, FolderOpen, type LucideIcon, Sparkles } from "lucide-react-native"
import { type ReactNode, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native"

import { MobileTextField } from "@/components/ui/MobileTextField"
import { useMobileColors } from "@/hooks/useMobileColors"

type OnboardingStep = "welcome" | "identity" | "preferences"
type PickMode = "create" | "open"

export interface PendingVaultFolder {
	path: string
	defaultName: string
}

interface OnboardingScreenProps {
	startupError?: string | null
	initialFolder?: PendingVaultFolder | null
	onCancel?: () => void
	onCreated?: () => void
}

interface VaultIconOption {
	Icon: LucideIcon
	icon: string
	label: string
}

const vaultIconOptions: VaultIconOption[] = [
	{ Icon: BookOpen, icon: "book-open", label: "Book" },
	{ Icon: Folder, icon: "folder", label: "Folder" },
	{ Icon: Sparkles, icon: "sparkles", label: "Spark" },
]

export function OnboardingScreen({
	startupError,
	initialFolder,
	onCancel,
	onCreated,
}: OnboardingScreenProps) {
	const router = useRouter()
	const { colors, iconColors } = useMobileColors()
	const version = useAppStore((state) => state.version)
	const firstRunOnboardingSeen = useAppStore((state) => state.firstRunOnboardingSeen)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const [selectedFolderPath, setSelectedFolderPath] = useState(initialFolder?.path ?? null)
	const [step, setStep] = useState<OnboardingStep>(initialFolder ? "identity" : "welcome")
	const [name, setName] = useState(initialFolder?.defaultName ?? DEFAULT_VAULT_NAME)
	const [icon, setIcon] = useState(vaultIconOptions[0].icon)
	const [preferences, setPreferences] = useState<SyncPreferences>(() =>
		createDefaultSyncPreferences(),
	)
	const [error, setError] = useState<string | null>(startupError ?? null)
	const [submitting, setSubmitting] = useState(false)
	const showRecentVaults = recentVaults.length > 0 && firstRunOnboardingSeen !== false
	const selectedIcon = useMemo(
		() => vaultIconOptions.find((option) => option.icon === icon) ?? vaultIconOptions[0],
		[icon],
	)
	const SelectedIcon = selectedIcon.Icon

	async function openExistingVault(entry: VaultRegistryEntry): Promise<void> {
		setSubmitting(true)
		setError(null)
		try {
			await openVaultSession(entry.path, getRegistryOpenOptions(entry))
			router.replace("/(notes)" as never)
		} catch (openError) {
			setError(getErrorMessage(openError))
		} finally {
			setSubmitting(false)
		}
	}

	async function chooseFolder(mode: PickMode): Promise<void> {
		setError(null)
		try {
			const folderPath = await getPlatform().dialog.pickFolder()
			if (!folderPath) return
			const picked =
				mode === "open"
					? await resolvePickedFolder(folderPath)
					: { kind: "new" as const, defaultName: await getDefaultVaultName(folderPath) }
			if (picked.kind === "existing") {
				await openExistingVault(picked.entry)
				return
			}
			setSelectedFolderPath(folderPath)
			setName(picked.defaultName)
			setStep("identity")
		} catch (pickError) {
			setError(getErrorMessage(pickError))
		}
	}

	async function createVault(): Promise<void> {
		if (!selectedFolderPath) {
			setError("Choose a folder before creating a vault.")
			setStep("welcome")
			return
		}

		setSubmitting(true)
		setError(null)
		try {
			await createVaultFromFolder(selectedFolderPath, {
				icon,
				name,
				syncPreferences: preferences,
			})
			onCreated?.()
			router.replace("/(notes)" as never)
		} catch (createError) {
			setError(getErrorMessage(createError))
		} finally {
			setSubmitting(false)
		}
	}

	function updatePreference(
		key: keyof Omit<SyncPreferences, "excludedPaths">,
		value: boolean,
	): void {
		setPreferences((current) => ({ ...current, [key]: value }))
	}

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			style={{ backgroundColor: colors.background }}
		>
			<View style={styles.header}>
				<View style={[styles.mark, { backgroundColor: colors.tint }]}>
					<SelectedIcon color="#ffffff" size={28} strokeWidth={2.4} />
				</View>
				<Text selectable style={[styles.title, { color: colors.label }]}>
					Cortex
				</Text>
				<Text selectable style={[styles.version, { color: colors.secondaryLabel }]}>
					{version ? `Version ${version}` : "Mobile"}
				</Text>
			</View>

			{error ? (
				<Text selectable style={[styles.errorText, { color: colors.destructive }]}>
					{error}
				</Text>
			) : null}

			{step === "welcome" ? (
				<View style={styles.panel}>
					<Text selectable style={[styles.body, { color: colors.secondaryLabel }]}>
						Start with a folder. Cortex writes normal Markdown notes there and keeps workspace
						metadata tucked away in .cortex.
					</Text>
					<View style={styles.actions}>
						<OnboardingButton
							disabled={submitting}
							icon={<Folder color="#ffffff" size={19} strokeWidth={2.4} />}
							label="Create vault"
							onPress={() => {
								void chooseFolder("create")
							}}
							primary
						/>
						<OnboardingButton
							disabled={submitting}
							icon={<FolderOpen color={iconColors.tint} size={19} strokeWidth={2.4} />}
							label="Open existing folder"
							onPress={() => {
								void chooseFolder("open")
							}}
						/>
					</View>
					{showRecentVaults ? (
						<View style={styles.recents}>
							<Text style={[styles.sectionLabel, { color: colors.secondaryLabel }]}>
								Recent Vaults
							</Text>
							{recentVaults.slice(0, 5).map((entry) => (
								<Pressable
									key={entry.uuid}
									onPress={() => {
										void openExistingVault(entry)
									}}
									style={({ pressed }) => [
										styles.recentRow,
										{
											backgroundColor: colors.secondaryBackground,
											borderColor: colors.separator,
											opacity: pressed ? 0.64 : 1,
										},
									]}
								>
									<View style={styles.recentText}>
										<Text numberOfLines={1} style={[styles.recentName, { color: colors.label }]}>
											{entry.name}
										</Text>
										<Text
											numberOfLines={1}
											style={[styles.recentPath, { color: colors.secondaryLabel }]}
										>
											{entry.displayPath ?? entry.path}
										</Text>
									</View>
								</Pressable>
							))}
						</View>
					) : null}
				</View>
			) : null}

			{step === "identity" ? (
				<View style={styles.panel}>
					<Text selectable style={[styles.stepTitle, { color: colors.label }]}>
						Customize your vault
					</Text>
					<Text selectable style={[styles.body, { color: colors.secondaryLabel }]}>
						Choose the name and icon that will identify this vault across Cortex.
					</Text>
					<MobileTextField
						autoCapitalize="words"
						autoCorrect={false}
						defaultValue={name}
						label="Name"
						onChangeText={setName}
						onSubmitText={() => setStep("preferences")}
						placeholder="Second brain"
						returnKeyType="done"
					/>
					<View style={styles.optionGroup}>
						<Text style={[styles.sectionLabel, { color: colors.secondaryLabel }]}>Icon</Text>
						<View style={styles.optionRow}>
							{vaultIconOptions.map((option) => (
								<Pressable
									key={option.icon}
									onPress={() => setIcon(option.icon)}
									style={[
										styles.iconOption,
										{
											backgroundColor:
												icon === option.icon ? colors.secondaryBackground : "transparent",
											borderColor: icon === option.icon ? colors.tint : colors.separator,
										},
									]}
								>
									<option.Icon
										color={icon === option.icon ? iconColors.tint : iconColors.secondary}
										size={20}
										strokeWidth={2.3}
									/>
									<Text style={[styles.iconOptionText, { color: colors.label }]}>
										{option.label}
									</Text>
								</Pressable>
							))}
						</View>
					</View>
					<View style={styles.actions}>
						<OnboardingButton label="Continue" onPress={() => setStep("preferences")} primary />
						<OnboardingButton
							label={onCancel ? "Cancel" : "Back"}
							onPress={onCancel ?? (() => setStep("welcome"))}
						/>
					</View>
				</View>
			) : null}

			{step === "preferences" ? (
				<View style={styles.panel}>
					<Text selectable style={[styles.stepTitle, { color: colors.label }]}>
						Preferences
					</Text>
					<Text selectable style={[styles.body, { color: colors.secondaryLabel }]}>
						These preferences are saved locally with the vault now. Sync can use the same settings
						later.
					</Text>
					<View style={[styles.preferenceGroup, { backgroundColor: colors.secondaryBackground }]}>
						<PreferenceRow
							label="Sync app settings"
							onValueChange={(value) => updatePreference("syncSettings", value)}
							value={preferences.syncSettings}
						/>
						<PreferenceRow
							label="Sync workspace layout"
							onValueChange={(value) => updatePreference("syncWorkspace", value)}
							value={preferences.syncWorkspace}
						/>
						<PreferenceRow
							label="Sync bookmarks"
							onValueChange={(value) => updatePreference("syncBookmarks", value)}
							value={preferences.syncBookmarks}
						/>
						<PreferenceRow
							label="Ignore images"
							onValueChange={(value) => updatePreference("ignoreImages", value)}
							value={preferences.ignoreImages}
						/>
					</View>
					<View style={styles.actions}>
						<OnboardingButton
							disabled={submitting}
							label={submitting ? "Creating..." : "Create vault"}
							onPress={() => {
								void createVault()
							}}
							primary
						/>
						<OnboardingButton
							disabled={submitting}
							label="Back"
							onPress={() => setStep("identity")}
						/>
					</View>
				</View>
			) : null}
		</ScrollView>
	)
}

function OnboardingButton({
	disabled,
	icon,
	label,
	onPress,
	primary,
}: {
	disabled?: boolean
	icon?: ReactNode
	label: string
	onPress: () => void
	primary?: boolean
}) {
	const { colors } = useMobileColors()

	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				{
					backgroundColor: primary ? colors.tint : colors.secondaryBackground,
					borderColor: primary ? colors.tint : colors.separator,
					opacity: disabled ? 0.42 : pressed ? 0.68 : 1,
				},
			]}
		>
			{icon}
			<Text style={[styles.buttonText, { color: primary ? "#ffffff" : colors.label }]}>
				{label}
			</Text>
		</Pressable>
	)
}

function PreferenceRow({
	label,
	onValueChange,
	value,
}: {
	label: string
	onValueChange: (value: boolean) => void
	value: boolean
}) {
	const { colors } = useMobileColors()

	return (
		<View style={[styles.preferenceRow, { borderColor: colors.separator }]}>
			<Text style={[styles.preferenceLabel, { color: colors.label }]}>{label}</Text>
			<Switch onValueChange={onValueChange} value={value} />
		</View>
	)
}

const styles = StyleSheet.create({
	actions: {
		gap: 10,
		width: "100%",
	},
	body: {
		fontSize: 16,
		letterSpacing: 0,
		lineHeight: 23,
		textAlign: "center",
	},
	button: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 8,
		justifyContent: "center",
		minHeight: 48,
		paddingHorizontal: 14,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 21,
	},
	content: {
		flexGrow: 1,
		justifyContent: "center",
		gap: 18,
		paddingHorizontal: 24,
		paddingVertical: 42,
	},
	errorText: {
		fontSize: 14,
		letterSpacing: 0,
		lineHeight: 20,
		textAlign: "center",
	},
	header: {
		alignItems: "center",
		gap: 6,
	},
	iconOption: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 8,
		minHeight: 40,
		paddingHorizontal: 12,
	},
	iconOptionText: {
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 18,
	},
	mark: {
		alignItems: "center",
		borderRadius: 16,
		height: 64,
		justifyContent: "center",
		width: 64,
	},
	optionGroup: {
		gap: 8,
		width: "100%",
	},
	optionRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	panel: {
		alignItems: "center",
		gap: 18,
		width: "100%",
	},
	preferenceGroup: {
		borderRadius: 8,
		overflow: "hidden",
		width: "100%",
	},
	preferenceLabel: {
		flex: 1,
		fontSize: 16,
		fontWeight: "500",
		letterSpacing: 0,
		lineHeight: 21,
	},
	preferenceRow: {
		alignItems: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 12,
		minHeight: 54,
		paddingHorizontal: 14,
	},
	recentName: {
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 20,
	},
	recentPath: {
		fontSize: 12,
		letterSpacing: 0,
		lineHeight: 16,
	},
	recentRow: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		minHeight: 54,
		paddingHorizontal: 12,
	},
	recentText: {
		flex: 1,
		minWidth: 0,
	},
	recents: {
		gap: 8,
		width: "100%",
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 16,
		textTransform: "uppercase",
	},
	stepTitle: {
		fontSize: 22,
		fontWeight: "800",
		letterSpacing: 0,
		lineHeight: 28,
		textAlign: "center",
	},
	title: {
		fontSize: 32,
		fontWeight: "800",
		letterSpacing: 0,
		lineHeight: 38,
	},
	version: {
		fontSize: 13,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 18,
	},
})
