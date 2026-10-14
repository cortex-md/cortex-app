import { usePluginStore } from "@cortex/plugin-host-core"
import { useMemo } from "react"
import { Platform } from "react-native"

import { openPluginView } from "@/features/plugins/openPluginView"
import { PluginContributionIcon } from "@/features/plugins/PluginIcon"
import { SidebarRow } from "@/features/sidebar/SidebarRows"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function PluginSidebarRows({ navigate }: { navigate: (action: () => void) => void }) {
	const sidebarItems = usePluginStore((state) => state.sidebarItems)
	const views = usePluginStore((state) => state.views)
	const { colors } = useMobileColors()
	const items = useMemo(() => {
		const sidebarViewKeys = new Set(
			views.flatMap((view) => (view.location === "sidebar-left" ? [view.key] : [])),
		)
		return sidebarItems.filter((item) => sidebarViewKeys.has(item.viewKey))
	}, [sidebarItems, views])

	return items.map((item) => (
		<SidebarRow
			key={item.key}
			label={item.label}
			leading={
				<PluginContributionIcon
					color={IS_IOS ? colors.tint : colors.secondaryLabel}
					name={item.icon}
					size={IS_IOS ? 20 : 24}
				/>
			}
			onPress={() => navigate(() => openPluginView(item.viewKey))}
		/>
	))
}
