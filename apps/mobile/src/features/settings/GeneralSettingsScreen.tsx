import { getErrorMessage, useAppStore, useAuthStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { Award, LogOut, MonitorSmartphone } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { useAccountSummary, useHostedSyncEntitlement } from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"
import { openSettings } from "@/features/navigation/routes"
import {
	SettingsBlock,
	SettingsFooter,
	SettingsScroll,
	SettingsSection,
} from "@/features/settings/SettingsLayout"
import { updateSetting } from "@/features/settings/settingsPages"
import { DEVICE_LABEL } from "@/features/vault/useVaultListItems"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const STORE_LABEL = IS_IOS ? "the App Store" : "Google Play"

async function signOut(): Promise<void> {
	try {
		await useAuthStore.getState().logout()
		toast("Signed out")
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function ProfileRow() {
	const { colors } = useMobileColors()
	const account = useAccountSummary()
	return (
		<View style={[styles.profile, { backgroundColor: colors.cell }]}>
			<Avatar name={account.displayName} size={36} />
			<View style={styles.profileBody}>
				<Text numberOfLines={1} style={[styles.profileName, { color: colors.label }]}>
					{account.displayName}
				</Text>
				<Text numberOfLines={1} style={[styles.profileMeta, { color: colors.secondaryLabel }]}>
					{account.email}
				</Text>
			</View>
		</View>
	)
}

function SignOutGroup({ onPress }: { onPress: () => void }) {
	const { colors } = useMobileColors()
	if (!IS_IOS) return null
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.signOut,
				{ backgroundColor: pressed ? colors.hover : colors.cell },
			]}
		>
			<Text style={[styles.signOutLabel, { color: colors.destructiveText }]}>Sign out</Text>
		</Pressable>
	)
}

export function GeneralSettingsScreen() {
	const version = useAppStore((state) => state.version)
	const autoOpenLastVault = useSettingsStore((state) => state.settings.general.autoOpenLastVault)
	const { planLabel } = useHostedSyncEntitlement()
	const [confirmSignOut, setConfirmSignOut] = useState(false)

	return (
		<SettingsScroll>
			<ProfileRow />
			<SettingsSection title="Account">
				<SettingsRow
					chevron
					Icon={IS_IOS ? undefined : Award}
					onPress={() => openSettings("plan")}
					title="Plan"
					value={planLabel}
				/>
				<SettingsRow
					chevron
					Icon={IS_IOS ? undefined : MonitorSmartphone}
					onPress={() => openSettings("sync")}
					title="Sync and devices"
				/>
				{!IS_IOS ? (
					<SettingsRow
						destructive
						Icon={LogOut}
						onPress={() => setConfirmSignOut(true)}
						title="Sign out"
					/>
				) : null}
			</SettingsSection>
			<SignOutGroup onPress={() => setConfirmSignOut(true)} />
			<SettingsFooter>
				{`Signing out keeps every vault on this ${DEVICE_LABEL}. Synced vaults stop syncing until you sign in again.`}
			</SettingsFooter>

			<SettingsBlock>
				<SettingsSection title="Updates">
					<SettingsRow title="Version" value={version ?? "0.2.0"} />
				</SettingsSection>
				<SettingsFooter>{`Updates arrive through ${STORE_LABEL}.`}</SettingsFooter>
			</SettingsBlock>

			<SettingsBlock>
				<SettingsSection title="Startup">
					<SettingsRow
						onToggle={(value) => updateSetting("general", "autoOpenLastVault", value)}
						title="Open last vault on startup"
						toggled={autoOpenLastVault}
					/>
				</SettingsSection>
				<SettingsFooter>
					Vaults are managed in{" "}
					<Text onPress={() => openSettings("vaults")} style={styles.link}>
						Settings → Vaults
					</Text>
					.
				</SettingsFooter>
			</SettingsBlock>

			<ConfirmDialog
				confirmLabel="Sign out"
				destructive
				message={`Every vault stays on this ${DEVICE_LABEL}. Synced vaults stop syncing until you sign in again.`}
				onCancel={() => setConfirmSignOut(false)}
				onConfirm={() => {
					setConfirmSignOut(false)
					void signOut()
				}}
				title="Sign out of Cortex?"
				visible={confirmSignOut}
			/>
		</SettingsScroll>
	)
}

const styles = StyleSheet.create({
	link: {
		textDecorationLine: "underline",
	},
	profile: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		gap: 12,
		marginHorizontal: 16,
		marginTop: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	profileBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	profileMeta: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	profileName: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		lineHeight: IS_IOS ? 22 : 24,
	},
	signOut: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 26,
		justifyContent: "center",
		marginHorizontal: 16,
		marginTop: 16,
		minHeight: 52,
	},
	signOutLabel: {
		fontSize: 17,
		lineHeight: 22,
	},
})
