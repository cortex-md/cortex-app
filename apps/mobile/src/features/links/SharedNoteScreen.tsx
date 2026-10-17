import { getErrorMessage, inlineAttachments, saveSharedNoteCopy, useVaultStore } from "@cortex/core"
import { reserveUniquePath, sanitizeFileStem } from "@cortex/import-export"
import type { SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import { readParam } from "@/features/history/useVersionHistory"
import { openNote } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type LoadState =
	| { status: "loading" }
	| { status: "ready"; bundle: SharedNoteBundle; markdown: string }
	| { status: "error"; message: string }

export function SharedNoteScreen() {
	const { colors } = useMobileColors()
	const themeTokens = useMobileEditorThemeTokens()
	const params = useLocalSearchParams<{ shareId?: string | string[]; key?: string | string[] }>()
	const shareId = readParam(params.shareId)
	const key = readParam(params.key)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [state, setState] = useState<LoadState>({ status: "loading" })

	useEffect(() => {
		if (!shareId || !key) return
		let canceled = false
		void getPlatform()
			.shares.open(shareId, key)
			.then(
				(bundle) => {
					if (!canceled) setState({ status: "ready", bundle, markdown: inlineAttachments(bundle) })
				},
				(error: unknown) => {
					if (!canceled) setState({ status: "error", message: getErrorMessage(error) })
				},
			)
		return () => {
			canceled = true
		}
	}, [key, shareId])

	const bundle = state.status === "ready" ? state.bundle : null
	const saveCopy = () => {
		if (!bundle || !vaultPath) {
			toast("Open a vault to save a copy")
			return
		}
		void saveSharedNoteCopy(bundle, vaultPath, { reserveUniquePath, sanitizeFileStem })
			.then((notePath) => {
				if (router.canGoBack()) router.back()
				openNote(notePath)
			})
			.catch((error: unknown) => toast(getErrorMessage(error)))
	}

	const title = bundle?.title || "Shared note"
	const linkMissing = !shareId || !key

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					title,
					headerRight:
						IS_IOS || !bundle
							? undefined
							: () => (
									<HeaderIconButton
										accessibilityLabel="Save a copy"
										icon={{ sf: "square.and.arrow.down", md: "download" }}
										onPress={saveCopy}
									/>
								),
				}}
			/>
			{IS_IOS && bundle ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button icon="square.and.arrow.down" onPress={saveCopy} />
				</Stack.Toolbar>
			) : null}
			{state.status === "ready" ? (
				<ScrollView
					contentContainerStyle={styles.content}
					contentInsetAdjustmentBehavior="automatic"
				>
					{state.bundle.author ? (
						<Text style={[styles.meta, { color: colors.secondaryLabel }]}>
							{`Shared by ${state.bundle.author}`}
						</Text>
					) : null}
					<View style={[styles.preview, { backgroundColor: colors.cell }]}>
						<MarkdownBlock
							content={state.markdown}
							dom={{
								matchContents: true,
								scrollEnabled: false,
								style: styles.transparent,
								useExpoDOMWebView: false,
							}}
							themeTokens={themeTokens}
						/>
					</View>
				</ScrollView>
			) : (
				<EmptyState
					description={state.status === "error" ? state.message : undefined}
					icon={{ sf: "link", md: "link" }}
					title={
						linkMissing
							? "This link is incomplete"
							: state.status === "error"
								? "Could not open the shared note"
								: "Opening shared note…"
					}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
	meta: {
		fontSize: 13,
		lineHeight: 18,
		marginHorizontal: 20,
		marginTop: 4,
	},
	preview: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		marginTop: 12,
		overflow: "hidden",
		padding: 12,
	},
	root: {
		flex: 1,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
