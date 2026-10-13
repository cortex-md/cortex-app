import { NativeTabs } from "expo-router/unstable-native-tabs"
import { Platform } from "react-native"

import { useTabBarHidden } from "@/features/navigation/tabBarVisibility"
import { useTodayBadge } from "@/features/navigation/useTodayBadge"
import { useMobileColors } from "@/hooks/useMobileColors"

export default function TabsLayout() {
	const hidden = useTabBarHidden()
	const badge = useTodayBadge()
	const { colors } = useMobileColors()

	const files = (
		<NativeTabs.Trigger key="files" name="(files)">
			<NativeTabs.Trigger.Icon sf={{ default: "folder", selected: "folder.fill" }} md="folder" />
			<NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
	const today = (
		<NativeTabs.Trigger key="today" name="(today)">
			<NativeTabs.Trigger.Icon
				sf={{ default: "checkmark.circle", selected: "checkmark.circle.fill" }}
				md="event_available"
			/>
			<NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
			{badge ? <NativeTabs.Trigger.Badge>{badge}</NativeTabs.Trigger.Badge> : null}
		</NativeTabs.Trigger>
	)
	const bookmarks = (
		<NativeTabs.Trigger key="bookmarks" name="(bookmarks)">
			<NativeTabs.Trigger.Icon sf={{ default: "bookmark", selected: "bookmark.fill" }} md="bookmark" />
			<NativeTabs.Trigger.Label>Bookmarks</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
	const tags = (
		<NativeTabs.Trigger key="tags" name="(tags)">
			<NativeTabs.Trigger.Icon sf={{ default: "tag", selected: "tag.fill" }} md="sell" />
			<NativeTabs.Trigger.Label>Tags</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
	const search = (
		<NativeTabs.Trigger key="search" name="(search)" role="search">
			<NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
			<NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
	const triggers =
		Platform.OS === "android"
			? [files, today, search, bookmarks, tags]
			: [files, today, bookmarks, tags, search]

	return (
		<NativeTabs
			badgeBackgroundColor={colors.destructive}
			badgeTextColor={colors.onDestructive}
			hidden={hidden}
			iconColor={{ default: colors.label, selected: colors.tint }}
			indicatorColor={colors.accentSubtle}
			labelStyle={{ default: { color: colors.label }, selected: { color: colors.tint } }}
			minimizeBehavior="onScrollDown"
			rippleColor={colors.accentSubtle}
			tintColor={colors.tint}
		>
			{triggers}
		</NativeTabs>
	)
}
