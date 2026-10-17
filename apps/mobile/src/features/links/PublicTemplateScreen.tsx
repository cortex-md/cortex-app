import { getErrorMessage, openPublicTemplate } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { readParam } from "@/features/history/useVersionHistory"
import { rememberOpenedPublicTemplate } from "@/features/marketplace/marketplaceAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

export function PublicTemplateScreen() {
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ slug?: string | string[] }>()
	const slug = readParam(params.slug)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!slug) return
		let canceled = false
		void openPublicTemplate(slug).then(
			(opened) => {
				if (canceled) return
				rememberOpenedPublicTemplate(slug, opened)
				router.replace({ pathname: "/from-template", params: { templateId: slug } })
			},
			(reason: unknown) => {
				if (!canceled) setError(getErrorMessage(reason))
			},
		)
		return () => {
			canceled = true
		}
	}, [slug])

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title: "Template" }} />
			<EmptyState
				description={error ?? undefined}
				icon={{ sf: "doc.on.doc", md: "dashboard_customize" }}
				title={
					!slug ? "This link is incomplete" : error ? "Could not open the template" : "Opening…"
				}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
