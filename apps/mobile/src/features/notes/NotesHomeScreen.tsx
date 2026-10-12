import { executeCommand } from "@cortex/commands"
import {
	consumePendingOnboardingNote,
	FILE_COMMAND_IDS,
	getFileTreeNodeTitle,
	useEditorStore,
	useVaultStore,
} from "@cortex/core"
import { Stack } from "expo-router"
import { FilePlus, FileText } from "lucide-react-native"
import { useEffect } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

import { openMobileNote } from "@/bootstrap/appCommands"
import { useMobileColors } from "@/hooks/useMobileColors"

function createRootNote(): void {
	executeCommand(FILE_COMMAND_IDS.newNote, { source: "menu" })
}

export default function NotesHomeScreen() {
	const { colors, iconColors } = useMobileColors()
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const loading = useVaultStore((state) => state.loading)
	const error = useVaultStore((state) => state.error)
	const pendingOnboardingNotePath = useVaultStore((state) => state.pendingOnboardingNotePath)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const activeEntry = files.find((file) => file.path === activeFilePath && !file.isDir) ?? null
	const activeTitle = activeEntry ? getFileTreeNodeTitle(activeEntry) : null

	useEffect(() => {
		if (pendingOnboardingNotePath) consumePendingOnboardingNote(openMobileNote)
	}, [pendingOnboardingNotePath])

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<Stack.Screen
				options={{
					headerLargeTitle: false,
					headerRight: () => (
						<Pressable
							accessibilityLabel="New note"
							hitSlop={8}
							onPress={createRootNote}
							style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.52 : 1 }]}
						>
							<FilePlus color={iconColors.tint} size={22} strokeWidth={2.35} />
						</Pressable>
					),
					title: vault?.name ?? "Cortex",
				}}
			/>
			<View style={styles.content}>
				<View style={[styles.iconFrame, { backgroundColor: colors.secondaryBackground }]}>
					<FileText color={iconColors.secondary} size={30} strokeWidth={2.15} />
				</View>
				<Text selectable style={[styles.title, { color: colors.label }]}>
					{activeTitle ?? "Cortex"}
				</Text>
				<Text selectable style={[styles.body, { color: colors.secondaryLabel }]}>
					{loading
						? "Loading vault"
						: activeTitle
							? (vault?.displayPath ?? vault?.path)
							: "No note selected"}
				</Text>
				{loading ? <ActivityIndicator color={colors.tint} /> : null}
				{error ? (
					<Text selectable style={[styles.errorText, { color: colors.destructive }]}>
						{error}
					</Text>
				) : null}
				{activeEntry ? (
					<Pressable
						onPress={() => openMobileNote(activeEntry.path)}
						style={({ pressed }) => [
							styles.primaryButton,
							{
								backgroundColor: colors.tint,
								opacity: pressed ? 0.7 : 1,
							},
						]}
					>
						<Text style={styles.primaryButtonText}>Open</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	body: {
		fontSize: 15,
		letterSpacing: 0,
		lineHeight: 21,
		textAlign: "center",
	},
	content: {
		alignItems: "center",
		flex: 1,
		gap: 12,
		justifyContent: "center",
		padding: 28,
	},
	errorText: {
		fontSize: 14,
		letterSpacing: 0,
		lineHeight: 20,
		textAlign: "center",
	},
	headerButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 32,
		minWidth: 32,
	},
	iconFrame: {
		alignItems: "center",
		borderRadius: 8,
		height: 62,
		justifyContent: "center",
		width: 62,
	},
	primaryButton: {
		alignItems: "center",
		borderRadius: 8,
		minHeight: 42,
		minWidth: 96,
		justifyContent: "center",
		paddingHorizontal: 18,
	},
	primaryButtonText: {
		color: "#ffffff",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 20,
	},
	root: {
		flex: 1,
	},
	title: {
		fontSize: 24,
		fontWeight: "800",
		letterSpacing: 0,
		lineHeight: 30,
		textAlign: "center",
	},
})
