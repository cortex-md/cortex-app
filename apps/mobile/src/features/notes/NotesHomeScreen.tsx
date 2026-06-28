import {
	getNotePathPresentation,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Stack, useRouter } from "expo-router"
import { FilePlus, FileText } from "lucide-react-native"
import { useEffect, useEffectEvent } from "react"
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	useColorScheme,
	View,
} from "react-native"

import { getMobileColorScheme, mobileColors, mobileIconColors } from "@/theme/colors"

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export default function NotesHomeScreen() {
	const router = useRouter()
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const iconColors = mobileIconColors[scheme]
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const loading = useVaultStore((state) => state.loading)
	const error = useVaultStore((state) => state.error)
	const pendingOnboardingNotePath = useVaultStore((state) => state.pendingOnboardingNotePath)
	const clearPendingOnboardingNotePath = useVaultStore(
		(state) => state.clearPendingOnboardingNotePath,
	)
	const createFile = useVaultStore((state) => state.createFile)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const setActiveFile = useEditorStore((state) => state.setActiveFile)
	const activeEntry = files.find((file) => file.path === activeFilePath && !file.isDir) ?? null
	const activeTitle = activeEntry
		? getNotePathPresentation(activeEntry.path, vault?.path).title || activeEntry.name
		: null

	function openNote(filePath: string): void {
		openTab(filePath, { reuseActive: true })
		setActiveFile(filePath)
		router.push({
			params: { filePath },
			pathname: "/(notes)/note" as never,
		})
	}

	async function createRootNote(): Promise<void> {
		if (!vault) return
		try {
			const filePath = await createFile(vault.path, "Untitled")
			openNote(filePath)
		} catch (createError) {
			await alertCreateError(createError)
		}
	}

	const openPendingOnboardingNote = useEffectEvent((filePath: string) => {
		openNote(filePath)
	})

	useEffect(() => {
		if (!pendingOnboardingNotePath) return
		openPendingOnboardingNote(pendingOnboardingNotePath)
		clearPendingOnboardingNotePath()
	}, [clearPendingOnboardingNotePath, pendingOnboardingNotePath])

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<Stack.Screen
				options={{
					headerLargeTitle: false,
					headerRight: () => (
						<Pressable
							accessibilityLabel="New note"
							hitSlop={8}
							onPress={() => {
								void createRootNote()
							}}
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
							? vault?.displayPath ?? vault?.path
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
						onPress={() => openNote(activeEntry.path)}
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

async function alertCreateError(error: unknown): Promise<void> {
	await getPlatform().dialog.showAlert({
		message: formatError(error),
		title: "Could not create note",
	})
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
