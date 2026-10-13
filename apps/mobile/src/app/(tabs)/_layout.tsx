import { NativeTabs } from "expo-router/unstable-native-tabs"
import { Platform } from "react-native"

import { useTabBarHidden } from "@/features/navigation/tabBarVisibility"
import { useTodayBadge } from "@/features/navigation/useTodayBadge"
import { useMobileColors } from "@/hooks/useMobileColors"

function FilesTrigger() {
	return (
		<NativeTabs.Trigger name="(files)">
			<NativeTabs.Trigger.Icon sf={{ default: "folder", selected: "folder.fill" }} md="folder" />
			<NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
}

function TodayTrigger({ badge }: { badge: string | undefined }) {
	return (
		<NativeTabs.Trigger name="(today)">
			<NativeTabs.Trigger.Icon
				sf={{ default: "checkmark.circle", selected: "checkmark.circle.fill" }}
				md="event_available"
			/>
			<NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
			{badge ? <NativeTabs.Trigger.Badge>{badge}</NativeTabs.Trigger.Badge> : null}
		</NativeTabs.Trigger>
	)
}

function BookmarksTrigger() {
	return (
		<NativeTabs.Trigger name="(bookmarks)">
			<NativeTabs.Trigger.Icon
				sf={{ default: "bookmark", selected: "bookmark.fill" }}
				md="bookmark"
			/>
			<NativeTabs.Trigger.Label>Bookmarks</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
}

function TagsTrigger() {
	return (
		<NativeTabs.Trigger name="(tags)">
			<NativeTabs.Trigger.Icon sf={{ default: "tag", selected: "tag.fill" }} md="sell" />
			<NativeTabs.Trigger.Label>Tags</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
}

function SearchTrigger() {
	return (
		<NativeTabs.Trigger name="(search)" role="search">
			<NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
			<NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
		</NativeTabs.Trigger>
	)
}

export default function TabsLayout() {
	const hidden = useTabBarHidden()
	const badge = useTodayBadge()
	const { colors } = useMobileColors()

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
			<FilesTrigger />
			<TodayTrigger badge={badge} />
			{Platform.OS === "android" ? <SearchTrigger /> : null}
			<BookmarksTrigger />
			<TagsTrigger />
			{Platform.OS === "ios" ? <SearchTrigger /> : null}
		</NativeTabs>
	)
}
