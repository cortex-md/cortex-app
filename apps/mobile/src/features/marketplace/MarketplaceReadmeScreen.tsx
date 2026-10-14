import { useMarketplaceStore } from "@cortex/marketplace"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect } from "react"
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text } from "react-native"

import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { openExternalUrl } from "@/features/marketplace/marketplaceNavigation"
import { useMobileColors } from "@/hooks/useMobileColors"

export function MarketplaceReadmeScreen() {
	const { id = "" } = useLocalSearchParams<{ id?: string }>()
	const { colors } = useMobileColors()
	const themeTokens = useMobileEditorThemeTokens()
	const entry = useMarketplaceStore(
		(state) =>
			state.pluginEntries.find((item) => item.id === id) ??
			state.themeEntries.find((item) => item.id === id),
	)
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
			{entry?.screenshots?.length ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.screenshots}
					style={styles.screenshotStrip}
				>
					{entry.screenshots.map((url, index) => (
						<Pressable
							accessibilityLabel={`${entry.name} screenshot ${index + 1}`}
							accessibilityRole="imagebutton"
							key={url}
							onPress={() => void openExternalUrl(url)}
						>
							<Image
								resizeMode="cover"
								source={{ uri: url }}
								style={[styles.screenshot, { backgroundColor: colors.secondaryBackground }]}
							/>
						</Pressable>
					))}
				</ScrollView>
			) : null}
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
	screenshot: {
		aspectRatio: 16 / 10,
		borderRadius: 10,
		height: 180,
	},
	screenshotStrip: {
		marginBottom: 16,
		marginHorizontal: -16,
	},
	screenshots: {
		gap: 12,
		paddingHorizontal: 16,
	},
	message: {
		fontSize: 15,
		textAlign: "center",
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
