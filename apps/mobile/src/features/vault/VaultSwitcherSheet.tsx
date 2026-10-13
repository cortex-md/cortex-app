import { useVaultStore, type VaultListItem, type VaultListStatus } from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import {
	Check,
	CloudDownload,
	CloudUpload,
	type LucideIcon,
	PauseCircle,
	Plus,
	Settings2,
	Smartphone,
	TriangleAlert,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"

import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SearchField } from "@/components/ui/SearchField"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { dismissSheet, openSettings, presentSheet } from "@/features/navigation/routes"
import { DEVICE_LABEL, useVaultListItems } from "@/features/vault/useVaultListItems"
import { useVaultSwitcher } from "@/features/vault/useVaultSwitcher"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const statusIcons: Record<VaultListStatus, LucideIcon> = {
	local: Smartphone,
	missing: TriangleAlert,
	paused: PauseCircle,
	synced: CloudUpload,
}

const statusLabels: Record<VaultListStatus, string> = {
	local: `Only on this ${DEVICE_LABEL}`,
	missing: "Folder not found",
	paused: "Sync paused",
	synced: "Synced",
}

function statusColor(status: VaultListStatus, colors: MobileColors): string {
	if (status === "synced") return colors.success
	if (status === "missing") return colors.warningText
	return colors.tertiaryLabel
}

function VaultDot({ color }: { color: string }) {
	return <View style={[styles.dot, { backgroundColor: color }]} />
}

function MessageCard({
	action,
	colors,
	message,
	onAction,
	warning,
}: {
	action: string
	colors: MobileColors
	message: string
	onAction: () => void
	warning?: boolean
}) {
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: warning ? colors.warningBackground : colors.secondaryBackground },
			]}
		>
			<Text style={[styles.cardText, { color: warning ? colors.warningText : colors.label }]}>
				{message}
			</Text>
			<Text onPress={onAction} style={[styles.cardAction, { color: colors.tint }]}>
				{action}
			</Text>
		</View>
	)
}

export function VaultSwitcherSheet() {
	const { colors } = useMobileColors()
	const currentUuid = useVaultStore((state) => state.vault?.uuid ?? null)
	const { items, loading, remoteOnly } = useVaultListItems()
	const { openVault, openingUuid } = useVaultSwitcher()
	const [query, setQuery] = useState("")
	const [message, setMessage] = useState<
		| { kind: "remote"; remote: RemoteVaultInfo }
		| { kind: "missing"; item: VaultListItem }
		| null
	>(null)

	const normalizedQuery = query.trim().toLowerCase()
	const localItems = useMemo(
		() => items.filter((item) => item.entry.name.toLowerCase().includes(normalizedQuery)),
		[items, normalizedQuery],
	)
	const remoteItems = useMemo(
		() => remoteOnly.filter((remote) => remote.name.toLowerCase().includes(normalizedQuery)),
		[remoteOnly, normalizedQuery],
	)

	async function handleOpen(item: VaultListItem) {
		if (item.status === "missing") {
			setMessage({ item, kind: "missing" })
			return
		}
		if (item.entry.uuid === currentUuid) {
			dismissSheet()
			return
		}
		const opened = await openVault(item.entry)
		if (opened) dismissSheet()
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetHeader onClose={dismissSheet} title="Switch vault" />
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				style={styles.scroll}
			>
				<SearchField
					accessibilityLabel="Find a vault"
					onChangeText={setQuery}
					onClear={() => setQuery("")}
					placeholder="Switch vault…"
					value={query}
				/>
				{message?.kind === "remote" ? (
					<MessageCard
						action="Get it from your account"
						colors={colors}
						message={`${message.remote.name} isn't on this ${DEVICE_LABEL} yet.`}
						onAction={() => {
							dismissSheet()
							presentSheet("add-vault", { remoteVaultId: message.remote.id, start: "download" })
						}}
					/>
				) : null}
				{message?.kind === "missing" ? (
					<MessageCard
						action="Locate it in Settings → Vaults"
						colors={colors}
						message={`${message.item.entry.name}: folder not found.`}
						onAction={() => {
							dismissSheet()
							openSettings("vaults")
						}}
						warning
					/>
				) : null}

				<GroupedSectionHeader>{`On this ${DEVICE_LABEL}`}</GroupedSectionHeader>
				{loading && localItems.length === 0 ? (
					<ActivityIndicator color={colors.tint} style={styles.spinner} />
				) : (
					<GroupedList>
						{localItems.map((item) => {
							const StatusIcon = statusIcons[item.status]
							const isCurrent = item.entry.uuid === currentUuid
							const opening = openingUuid === item.entry.uuid
							return (
								<GroupedRow
									accessibilityLabel={`${item.entry.name}, ${statusLabels[item.status]}`}
									key={item.entry.uuid}
									leading={<VaultDot color={item.color} />}
									onPress={() => void handleOpen(item)}
									subtitle={
										item.syncConfig?.remoteVaultId && item.remoteVaultId
											? undefined
											: item.status === "missing"
												? statusLabels.missing
												: undefined
									}
									title={item.entry.name}
									trailing={
										<View style={styles.trailing}>
											<StatusIcon
												accessibilityLabel={statusLabels[item.status]}
												color={statusColor(item.status, colors)}
												size={18}
												strokeWidth={2.2}
											/>
											{opening ? (
												<Text style={[styles.opening, { color: colors.secondaryLabel }]}>Opening…</Text>
											) : isCurrent ? (
												<Check color={colors.tint} size={20} strokeWidth={2.6} />
											) : null}
										</View>
									}
								/>
							)
						})}
					</GroupedList>
				)}

				{remoteItems.length > 0 ? (
					<>
						<GroupedSectionHeader>In your account</GroupedSectionHeader>
						<GroupedList>
							{remoteItems.map((remote) => (
								<GroupedRow
									key={remote.id}
									leading={<VaultDot color={colors.tertiaryLabel} />}
									onPress={() => setMessage({ kind: "remote", remote })}
									title={remote.name}
									trailing={
										<CloudDownload
											accessibilityLabel={`Download to this ${DEVICE_LABEL}`}
											color={colors.tertiaryLabel}
											size={18}
											strokeWidth={2.2}
										/>
									}
								/>
							))}
						</GroupedList>
					</>
				) : null}

				<View style={styles.footerGroup}>
					<GroupedList>
						<GroupedRow
							leading={<Plus color={colors.tint} size={20} strokeWidth={2.2} />}
							onPress={() => {
								dismissSheet()
								presentSheet("add-vault")
							}}
							subtitle="New · open a folder · download"
							tint
							title="Add a vault…"
						/>
						<GroupedRow
							chevron
							leading={<Settings2 color={colors.label} size={20} strokeWidth={2.2} />}
							onPress={() => {
								dismissSheet()
								openSettings("vaults")
							}}
							title="Manage vaults…"
						/>
					</GroupedList>
				</View>
				<GroupedFooter>Switch vault from the Files title or the sidebar header.</GroupedFooter>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderCurve: "continuous",
		borderRadius: 18,
		gap: 6,
		marginHorizontal: 16,
		marginTop: 16,
		padding: 16,
	},
	cardAction: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	cardText: {
		fontSize: 15,
		lineHeight: 20,
	},
	content: {
		paddingBottom: 40,
		paddingTop: 4,
	},
	dot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	footerGroup: {
		marginTop: 24,
	},
	opening: {
		fontSize: 15,
		lineHeight: 20,
	},
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	spinner: {
		marginVertical: 24,
	},
	trailing: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
	},
})
