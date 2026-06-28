import { FieldGroup, Host, ListItem, Switch } from "@expo/ui"
import { useState } from "react"
import { ScrollView, StyleSheet, useColorScheme } from "react-native"

import { getMobileColorScheme, mobileColors } from "@/theme/colors"
import { createMobileThemeAdapter } from "@/theme/mobile-theme"

export default function SettingsScreen() {
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const themeAdapter = createMobileThemeAdapter(null, scheme)
	const [communityThemesEnabled, setCommunityThemesEnabled] = useState(true)
	const [nativeMaterialsEnabled, setNativeMaterialsEnabled] = useState(true)

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			style={{ backgroundColor: colors.background }}
		>
			<Host>
				<FieldGroup>
					<FieldGroup.Section title="Appearance">
						<ListItem
							supportingText={themeAdapter.source}
							trailing={
								<Switch
									label="Community themes"
									onValueChange={setCommunityThemesEnabled}
									value={communityThemesEnabled}
								/>
							}
						>
							Community themes
						</ListItem>
						<ListItem
							supportingText="Native materials stay authoritative"
							trailing={
								<Switch
									label="Native materials"
									onValueChange={setNativeMaterialsEnabled}
									value={nativeMaterialsEnabled}
								/>
							}
						>
							Native materials
						</ListItem>
					</FieldGroup.Section>

					<FieldGroup.Section title="Editor">
						<ListItem supportingText="Native screen chrome">Markdown editor</ListItem>
						<ListItem supportingText="Inside the editor surface">Selection toolbar</ListItem>
					</FieldGroup.Section>
				</FieldGroup>
			</Host>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 12,
		paddingVertical: 16,
	},
})
