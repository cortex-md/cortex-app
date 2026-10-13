import type { SyncPreferences } from "@cortex/platform"
import { Host, Switch } from "@expo/ui"
import {
	Bookmark,
	FileText,
	Folder,
	Image as ImageIcon,
	LayoutDashboard,
	type LucideIcon,
	Plus,
	SlidersHorizontal,
	X,
} from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"

import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { OnboardingButton, OnboardingTitle, OnboardingTopBar } from "@/features/onboarding/OnboardingChrome"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type ToggleKey = "ignoreImages" | "syncSettings" | "syncWorkspace" | "syncBookmarks"

const toggleRows: { key: ToggleKey; label: string; Icon: LucideIcon }[] = [
	{ Icon: ImageIcon, key: "ignoreImages", label: "Ignore images" },
	{ Icon: SlidersHorizontal, key: "syncSettings", label: "Sync app settings" },
	{ Icon: LayoutDashboard, key: "syncWorkspace", label: "Sync workspace layout" },
	{ Icon: Bookmark, key: "syncBookmarks", label: "Sync bookmarks" },
]

export function OnboardingSync({
	onBack,
	onChange,
	onCreate,
	preferences,
	submitting,
}: {
	onBack: () => void
	onChange: (preferences: SyncPreferences) => void
	onCreate: () => void
	preferences: SyncPreferences
	submitting: boolean
}) {
	const { colors } = useMobileColors()
	const [addingPath, setAddingPath] = useState(false)

	function addExcludedPath(path: string) {
		setAddingPath(false)
		if (preferences.excludedPaths.includes(path)) return
		onChange({ ...preferences, excludedPaths: [...preferences.excludedPaths, path] })
	}

	function removeExcludedPath(path: string) {
		onChange({
			...preferences,
			excludedPaths: preferences.excludedPaths.filter((candidate) => candidate !== path),
		})
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<OnboardingTopBar onBack={submitting ? undefined : onBack} />
			<ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
				<OnboardingTitle
					subtitle="Set sync preferences before this vault connects to any remote."
					title="Sync preferences"
				/>
				<GroupedSectionHeader>Sync</GroupedSectionHeader>
				<GroupedList>
					{toggleRows.map((row) => (
						<GroupedRow
							key={row.key}
							leading={IS_IOS ? undefined : <row.Icon color={colors.secondaryLabel} size={24} strokeWidth={2} />}
							onPress={() => onChange({ ...preferences, [row.key]: !preferences[row.key] })}
							title={row.label}
							trailing={
								<Host matchContents>
									<Switch
										label={row.label}
										onValueChange={(value) => onChange({ ...preferences, [row.key]: value })}
										value={preferences[row.key]}
									/>
								</Host>
							}
						/>
					))}
				</GroupedList>

				<GroupedSectionHeader>Excluded paths</GroupedSectionHeader>
				<GroupedList>
					{preferences.excludedPaths.map((path) => {
						const PathIcon = path.includes("*") || path.includes(".") ? FileText : Folder
						return (
							<GroupedRow
								key={path}
								leading={<PathIcon color={colors.secondaryLabel} size={IS_IOS ? 20 : 24} strokeWidth={2} />}
								title={path}
								trailing={
									<Pressable
										accessibilityLabel={`Remove ${path}`}
										hitSlop={8}
										onPress={() => removeExcludedPath(path)}
									>
										<X color={colors.tertiaryLabel} size={18} strokeWidth={2.4} />
									</Pressable>
								}
							/>
						)
					})}
					<GroupedRow
						leading={<Plus color={colors.tint} size={IS_IOS ? 20 : 24} strokeWidth={2.2} />}
						onPress={() => setAddingPath(true)}
						tint
						title="Add path"
					/>
				</GroupedList>
				<GroupedFooter>
					Files, folders, and patterns excluded from sync will not be uploaded to the remote vault.
				</GroupedFooter>
			</ScrollView>
			<View style={IS_IOS ? styles.footerIos : styles.footerAndroid}>
				{IS_IOS ? (
					<>
						<OnboardingButton busy={submitting} label="Create vault" onPress={onCreate} variant="primary" />
						<OnboardingButton disabled={submitting} label="Back" onPress={onBack} variant="plain" />
					</>
				) : (
					<>
						<OnboardingButton disabled={submitting} label="Back" onPress={onBack} variant="plain" />
						<OnboardingButton busy={submitting} label="Create vault" onPress={onCreate} variant="primary" />
					</>
				)}
			</View>
			<TextPromptDialog
				confirmLabel="Add"
				key={addingPath ? "open" : "closed"}
				message="A folder, a file, or a pattern such as *.pdf"
				onCancel={() => setAddingPath(false)}
				onConfirm={addExcludedPath}
				placeholder="Archive"
				title="Add path"
				visible={addingPath}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 24,
	},
	footerAndroid: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingBottom: 48,
		paddingHorizontal: 24,
		paddingTop: 12,
	},
	footerIos: {
		gap: 6,
		paddingBottom: 44,
		paddingHorizontal: 20,
		paddingTop: 12,
	},
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
})
