import { getBaseName } from "@cortex/platform/utils"
import { Stack, useLocalSearchParams } from "expo-router"
import * as Sharing from "expo-sharing"
import { useEffect, useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"

import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { toast } from "@/features/feedback/useToast"
import { readParam } from "@/features/history/useVersionHistory"
import { useMobileColors } from "@/hooks/useMobileColors"
import { resolveActualFileUri } from "@/platform/fileUri"

const IS_IOS = Platform.OS === "ios"
const PDF_MIME_TYPE = "application/pdf"

function parentUri(uri: string): string {
	return uri.slice(0, uri.lastIndexOf("/") + 1)
}

async function openWithSystem(uri: string): Promise<void> {
	if (!(await Sharing.isAvailableAsync())) {
		toast("No app can open PDFs on this device")
		return
	}
	await Sharing.shareAsync(uri, { mimeType: PDF_MIME_TYPE, UTI: "com.adobe.pdf" })
}

export function PdfViewerScreen() {
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const [uri, setUri] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!filePath) return
		let canceled = false
		void resolveActualFileUri(filePath).then(
			(resolved) => {
				if (!canceled) setUri(resolved)
			},
			(reason: unknown) => {
				if (!canceled) setError(reason instanceof Error ? reason.message : String(reason))
			},
		)
		return () => {
			canceled = true
		}
	}, [filePath])

	const title = filePath ? getBaseName(filePath).replace(/\.pdf$/i, "") : "PDF"
	const share = () => {
		if (uri) void openWithSystem(uri)
	}
	const inline = IS_IOS && Boolean(uri?.startsWith("file://"))

	useEffect(() => {
		if (uri && !inline) void openWithSystem(uri)
	}, [inline, uri])

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					title,
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Open with"
									icon={{ sf: "square.and.arrow.up", md: "open_in_new" }}
									onPress={share}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button icon="square.and.arrow.up" onPress={share} />
				</Stack.Toolbar>
			) : null}
			{inline && uri ? (
				<WebView
					allowFileAccess
					allowingReadAccessToURL={parentUri(uri)}
					originWhitelist={["*"]}
					source={{ uri }}
					style={styles.root}
				/>
			) : (
				<EmptyState
					description={uri && !error ? "Opened in another app." : undefined}
					icon={{ sf: "doc.richtext", md: "picture_as_pdf" }}
					title={error ?? (uri ? title : "Loading…")}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
