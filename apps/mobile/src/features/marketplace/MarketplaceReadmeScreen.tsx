import { useMarketplaceStore } from "@cortex/marketplace"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native"

import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { openExternalUrl } from "@/features/marketplace/marketplaceNavigation"
import { useMobileColors } from "@/hooks/useMobileColors"

export function MarketplaceReadmeScreen() {
	const { id = "" } = useLocalSearchParams<{ id?: string }>()
	const { colors } = useMobileColors()
	const themeTokens = useMobileEditorThemeTokens()
	const entry = useMarketplaceStore((state) => state.pluginEntries.find((item) => item.id === id))
	const readme = useMarketplaceStore((state) => state.readmeCache[id])
	const loadReadme = useMarketplaceStore((state) => state.loadReadme)

	useEffect(() => {
		if (entry) void loadReadme(entry)
	}, [entry, loadReadme])

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			style={{ backgroundColor: colors.background }}
		>
			<Stack.Screen options={{ title: entry?.name ?? "README" }} />
			{entry && readme === undefined ? (
				<ActivityIndicator color={colors.tint} />
			) : readme ? (
				<MarkdownBlock
					content={readme}
					dom={{
						matchContents: true,
						scrollEnabled: false,
						style: styles.transparent,
						useExpoDOMWebView: false,
					}}
					onLinkPress={openExternalUrl}
					themeTokens={themeTokens}
				/>
			) : (
				<Text style={[styles.message, { color: colors.secondaryLabel }]}>No README available.</Text>
			)}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		padding: 16,
	},
	message: {
		fontSize: 15,
		textAlign: "center",
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
