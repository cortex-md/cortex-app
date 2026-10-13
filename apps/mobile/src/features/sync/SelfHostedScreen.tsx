import {
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	SELF_HOSTED_ENVIRONMENT_GROUPS,
	type SelfHostedEnvironmentField,
	type SelfHostedEnvironmentGroup,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { Collapsible, FieldGroup, Host } from "@expo/ui"
import { useEffect, useState } from "react"
import { Platform, StyleSheet, Text, TextInput, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { toast } from "@/features/feedback/useToast"
import {
	ActionButton,
	SettingsBlock,
	SettingsFooterText,
	SettingsGroup,
	SettingsPage,
} from "@/features/sync/SettingsPage"
import {
	copyEnvironmentFile,
	exportEnvironmentFile,
	loadSelfHostedSecrets,
	saveSelfHostedSecret,
} from "@/features/sync/syncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" })
const COPIED_FEEDBACK_MS = 2000

function countFields(group: SelfHostedEnvironmentGroup): number {
	return group.sections.reduce((total, section) => total + section.fields.length, 0)
}

function EnvironmentFieldRow({
	field,
	onCommit,
	value,
}: {
	field: SelfHostedEnvironmentField
	onCommit: (value: string) => void
	value: string
}) {
	const { colors } = useMobileColors()
	const [draft, setDraft] = useState(value)

	return (
		<View style={styles.fieldRow}>
			<View style={styles.fieldHead}>
				<Text style={[styles.fieldKey, { color: colors.label }]}>{field.key}</Text>
				{field.secret ? <Badge label="Secret" /> : null}
			</View>
			<Text style={[styles.fieldLabel, { color: colors.secondaryLabel }]}>{field.label}</Text>
			<TextInput
				autoCapitalize="none"
				autoCorrect={false}
				onChangeText={setDraft}
				onEndEditing={() => onCommit(draft)}
				placeholder={field.defaultValue}
				placeholderTextColor={colors.placeholder}
				secureTextEntry={field.secret}
				style={[
					styles.fieldInput,
					{ backgroundColor: colors.fill, borderColor: colors.borderSubtle, color: colors.label },
				]}
				value={draft}
			/>
		</View>
	)
}

export function SelfHostedScreen() {
	const { colors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const setSelfHosted = useRemoteVaultStore((state) => state.setSelfHosted)
	const saveServerUrl = useRemoteVaultStore((state) => state.saveServerUrl)
	const updateSelfHostedEnvironment = useRemoteVaultStore(
		(state) => state.updateSelfHostedEnvironment,
	)
	const [url, setUrl] = useState(() => syncConfig.serverUrl ?? DEFAULT_SELF_HOSTED_SYNC_SERVER_URL)
	const [saved, setSaved] = useState(false)
	const [copied, setCopied] = useState(false)
	const [secrets, setSecrets] = useState<Record<string, string>>({})
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
		server: true,
		authentication: true,
	})
	const vaultId = vault?.uuid ?? null
	const vaultPath = vault?.path ?? null

	useEffect(() => {
		if (!vaultId) return
		let cancelled = false
		void loadSelfHostedSecrets(vaultId).then((loaded) => {
			if (!cancelled) setSecrets(loaded)
		})
		return () => {
			cancelled = true
		}
	}, [vaultId])

	useEffect(() => {
		if (!copied) return
		const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
		return () => clearTimeout(timer)
	}, [copied])

	const values = syncConfig.selfHostedEnvironment

	const commitField = (field: SelfHostedEnvironmentField, value: string) => {
		if (field.secret) {
			if (!vaultId) return
			setSecrets((current) => ({ ...current, [field.key]: value }))
			void saveSelfHostedSecret(vaultId, field.key, value)
			return
		}
		if (!vaultPath) return
		void updateSelfHostedEnvironment(vaultPath, field.key, value.trim() || null)
	}

	const handleSave = () => {
		if (!vaultPath) return
		void saveServerUrl(vaultPath, url.trim()).then(() => setSaved(true))
	}

	const handleCopy = () => {
		void copyEnvironmentFile(values, secrets).then(() => setCopied(true))
	}

	const handleExport = () => {
		void exportEnvironmentFile(values, secrets).catch(() => toast("Export was cancelled"))
	}

	return (
		<SettingsPage subtitle="Point this vault at your own sync server instead of Cortex Cloud.">
			<SettingsGroup>
				<FieldGroup.Section title="Connection">
					<SettingsRow
						onToggle={(value) => {
							if (vaultPath) void setSelfHosted(vaultPath, value)
						}}
						subtitle="Applies to this vault only"
						title="Use a self-hosted server"
						toggled={syncConfig.selfHosted}
					/>
				</FieldGroup.Section>
			</SettingsGroup>
			<View style={[styles.urlRow, { backgroundColor: colors.cell }]}>
				<TextInput
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					onChangeText={(value) => {
						setUrl(value)
						setSaved(false)
					}}
					onSubmitEditing={handleSave}
					placeholder="https://sync.example.com"
					placeholderTextColor={colors.placeholder}
					returnKeyType="done"
					style={[styles.urlInput, { color: colors.label }]}
					value={url}
				/>
				<ActionButton
					disabled={saved || !url.trim()}
					label={saved ? "Saved" : "Save"}
					onPress={handleSave}
					variant={IS_IOS ? "text" : "outlined"}
				/>
			</View>
			<SettingsFooterText>Remote vaults and login use this URL.</SettingsFooterText>

			<SettingsBlock
				title="Environment"
				trailing={
					<View style={styles.headerActions}>
						<ActionButton label={copied ? "Copied" : "Copy .env"} onPress={handleCopy} variant="text" />
						<ActionButton label="Export" onPress={handleExport} variant="text" />
					</View>
				}
			>
				{SELF_HOSTED_ENVIRONMENT_GROUPS.map((group) => {
					const isOpen = Boolean(openGroups[group.id])
					return (
						<View key={group.id} style={[styles.groupCard, { backgroundColor: colors.cell }]}>
							<Host matchContents>
								<Collapsible
									isOpen={isOpen}
									label={`${group.label} · ${countFields(group)}`}
									labelStyle={{ color: colors.label, fontWeight: "600" }}
									onOpenChange={(open) => setOpenGroups((current) => ({ ...current, [group.id]: open }))}
								>
									<View style={styles.groupBody}>
										<Text style={[styles.groupDescription, { color: colors.secondaryLabel }]}>
											{group.description}
										</Text>
										{group.sections.flatMap((section) =>
											section.fields.map((field) => (
												<EnvironmentFieldRow
													field={field}
													key={field.key}
													onCommit={(value) => commitField(field, value)}
													value={field.secret ? (secrets[field.key] ?? "") : (values[field.key] ?? "")}
												/>
											)),
										)}
									</View>
								</Collapsible>
							</Host>
						</View>
					)
				})}
				<SettingsFooterText>
					{`Values are saved for this vault. Secrets are stored in the ${IS_IOS ? "iOS keychain" : "Android Keystore"}.`}
				</SettingsFooterText>
			</SettingsBlock>
		</SettingsPage>
	)
}

const styles = StyleSheet.create({
	fieldHead: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
	fieldInput: {
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		fontFamily: MONO_FONT,
		fontSize: 14,
		minHeight: 42,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	fieldKey: {
		flexShrink: 1,
		fontFamily: MONO_FONT,
		fontSize: 13,
		lineHeight: 18,
	},
	fieldLabel: {
		fontSize: 12,
		lineHeight: 16,
	},
	fieldRow: {
		gap: 6,
	},
	groupBody: {
		gap: 14,
		paddingBottom: 4,
		paddingTop: 8,
	},
	groupCard: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 20 : 16,
		marginBottom: 8,
		marginHorizontal: 16,
		overflow: "hidden",
		paddingHorizontal: 16,
		paddingVertical: 6,
	},
	groupDescription: {
		fontSize: 13,
		lineHeight: 18,
	},
	headerActions: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	urlInput: {
		flex: 1,
		fontFamily: MONO_FONT,
		fontSize: 15,
		minHeight: 44,
		minWidth: 0,
		padding: 0,
	},
	urlRow: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		gap: 8,
		marginHorizontal: 16,
		marginTop: 8,
		paddingLeft: 16,
		paddingRight: 8,
		paddingVertical: 4,
	},
})
