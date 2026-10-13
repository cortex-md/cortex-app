import type { VaultRegistryEntry } from "@cortex/platform"
import { FileText, FolderOpen, FolderPlus, Network } from "lucide-react-native"
import { Image, Platform, StyleSheet, Text, View } from "react-native"

import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { OnboardingButton, OnboardingTopBar, TextButton } from "@/features/onboarding/OnboardingChrome"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const appIcon = require("@/assets/images/icon.png")

export function OnboardingWelcome({
	error,
	onCreate,
	onOpen,
	onOpenRecent,
	onSignIn,
	recentVaults,
	submitting,
}: {
	error: string | null
	onCreate: () => void
	onOpen: () => void
	onOpenRecent: (entry: VaultRegistryEntry) => void
	onSignIn: () => void
	recentVaults: VaultRegistryEntry[]
	submitting: boolean
}) {
	const { colors } = useMobileColors()

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<OnboardingTopBar trailing={<TextButton label="Sign in" onPress={onSignIn} />} />
			<View style={styles.body}>
				<Image accessibilityLabel="Cortex app icon" source={appIcon} style={styles.icon} />
				<View style={styles.copy}>
					<Text accessibilityRole="header" style={[styles.title, { color: colors.label }]}>
						Cortex
					</Text>
					<Text style={[styles.lead, { color: colors.secondaryLabel }]}>
						Start with a folder. Cortex writes normal Markdown notes there and keeps workspace
						metadata tucked away in .cortex.
					</Text>
				</View>
				<View style={styles.list}>
					<GroupedList>
						<GroupedRow
							multiline
							leading={<RowIcon Icon={FileText} />}
							title="Your notes stay readable as files, even outside Cortex."
						/>
						<GroupedRow
							multiline
							leading={<RowIcon Icon={Network} />}
							title="The welcome note opens after the vault is ready."
						/>
					</GroupedList>
				</View>
				{error ? <Text style={[styles.error, { color: colors.destructiveText }]}>{error}</Text> : null}
			</View>
			<View style={styles.actions}>
				<OnboardingButton
					Icon={FolderPlus}
					busy={submitting}
					label="Create new vault"
					onPress={onCreate}
					variant="primary"
				/>
				<OnboardingButton
					Icon={FolderOpen}
					disabled={submitting}
					label="Open folder"
					onPress={onOpen}
					variant="secondary"
				/>
				{recentVaults.length > 0 ? (
					<View style={styles.recent}>
						<NativeMenu
							accessibilityLabel="Recent vaults"
							anchorStyle="plain"
							groups={[
								recentVaults.slice(0, 8).map((entry) => ({
									key: entry.uuid,
									label: entry.name,
									onPress: () => onOpenRecent(entry),
									subtitle: entry.displayPath ?? entry.path,
								})),
							]}
							title="Recent vaults"
						/>
					</View>
				) : null}
			</View>
		</View>
	)
}

function RowIcon({ Icon }: { Icon: typeof FileText }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.rowIcon, { backgroundColor: IS_IOS ? colors.fill : colors.fill2 }]}>
			<Icon color={IS_IOS ? colors.label : colors.secondaryLabel} size={IS_IOS ? 18 : 20} strokeWidth={2} />
		</View>
	)
}

const styles = StyleSheet.create({
	actions: {
		gap: IS_IOS ? 10 : 12,
		paddingBottom: IS_IOS ? 44 : 48,
		paddingHorizontal: IS_IOS ? 20 : 24,
	},
	body: {
		flex: 1,
		gap: 20,
		justifyContent: "center",
		paddingBottom: 40,
		paddingHorizontal: IS_IOS ? 28 : 24,
	},
	copy: {
		gap: IS_IOS ? 10 : 12,
	},
	error: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
	icon: {
		borderCurve: "continuous",
		borderRadius: 20,
		height: 88,
		width: 88,
	},
	lead: {
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
	},
	list: {
		marginHorizontal: -16,
		marginTop: 8,
	},
	recent: {
		alignItems: "center",
	},
	root: {
		flex: 1,
	},
	rowIcon: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 8 : 999,
		height: IS_IOS ? 30 : 40,
		justifyContent: "center",
		width: IS_IOS ? 30 : 40,
	},
	title: {
		fontSize: IS_IOS ? 34 : 36,
		fontWeight: IS_IOS ? "700" : "500",
		letterSpacing: IS_IOS ? 0.4 : 0,
		lineHeight: IS_IOS ? 41 : 44,
	},
})
