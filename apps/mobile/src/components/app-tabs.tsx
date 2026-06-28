import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useColorScheme } from "react-native"

import { getMobileColorScheme, mobileColors } from "@/theme/colors"

export default function AppTabs() {
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]

	return (
		<NativeTabs
			backgroundColor={colors.tabBarBackground}
			blurEffect="systemMaterial"
			indicatorColor={colors.tabIndicator}
			labelStyle={{
				default: { color: colors.secondaryLabel },
				selected: { color: colors.label },
			}}
			rippleColor={colors.tabRipple}
		>
			<NativeTabs.Trigger name="(notes)">
				<NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					md={{ default: "article", selected: "article" }}
					sf={{ default: "doc.text", selected: "doc.text.fill" }}
				/>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="(settings)">
				<NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					md={{ default: "settings", selected: "settings" }}
					sf={{ default: "gearshape", selected: "gearshape.fill" }}
				/>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="(search)" role="search">
				<NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					md={{ default: "search", selected: "search" }}
					sf="magnifyingglass"
				/>
			</NativeTabs.Trigger>
		</NativeTabs>
	)
}
