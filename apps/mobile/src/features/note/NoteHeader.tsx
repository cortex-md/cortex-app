import type { EditorMode } from "@cortex/core"
import type { NativeStackNavigationOptions } from "expo-router"
import { Stack } from "expo-router"
import { StyleSheet, View } from "react-native"

import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import type { SymbolName } from "@/components/ui/Symbol"
import {
	AndroidFindHeaderLeft,
	AndroidFindHeaderRight,
	AndroidFindHeaderTitle,
} from "@/features/note/FindBar"
import { NOTE_MENU_ICON, NOTE_MENU_LABEL } from "@/features/note/noteMenu"
import type { FindInNote } from "@/features/note/useFindInNote"
import type { MobileColors } from "@/theme/colors"

export interface ModePresentation {
	label: string
	icon: SymbolName
	next: EditorMode
}

const modePresentations: Record<"live-preview" | "source" | "reading", ModePresentation> = {
	"live-preview": { label: "Preview", icon: { sf: "eye", md: "visibility" }, next: "source" },
	source: {
		label: "Source",
		icon: { sf: "chevron.left.forwardslash.chevron.right", md: "code" },
		next: "reading",
	},
	reading: { label: "Reading", icon: { sf: "book", md: "menu_book" }, next: "live-preview" },
}

export function getModePresentation(mode: EditorMode): ModePresentation {
	return mode === "source" || mode === "reading"
		? modePresentations[mode]
		: modePresentations["live-preview"]
}

export interface NoteHeaderState {
	colors: MobileColors
	find: FindInNote
	menuGroups: MenuGroup[]
	mode: ModePresentation
	onCycleMode: () => void
	title: string
}

function modeLabel(mode: ModePresentation): string {
	return `Editor mode: ${mode.label}. Tap to switch.`
}

function AndroidActions({ state }: { state: NoteHeaderState }) {
	return (
		<View style={styles.androidActions}>
			<HeaderIconButton
				accessibilityLabel={modeLabel(state.mode)}
				icon={state.mode.icon}
				onPress={state.onCycleMode}
			/>
			<NativeMenu
				accessibilityLabel={NOTE_MENU_LABEL}
				groups={state.menuGroups}
				icon={NOTE_MENU_ICON}
			/>
		</View>
	)
}

export function buildNoteScreenOptions(
	state: NoteHeaderState,
	isIos: boolean,
): NativeStackNavigationOptions {
	const androidFind = !isIos && state.find.open
	return {
		headerBackButtonDisplayMode: "minimal",
		headerLargeTitleEnabled: false,
		headerShadowVisible: false,
		headerStyle: { backgroundColor: state.colors.background },
		headerTransparent: false,
		title: state.title,
		headerTitle: androidFind ? () => <AndroidFindHeaderTitle find={state.find} /> : "",
		headerLeft: androidFind ? () => <AndroidFindHeaderLeft find={state.find} /> : undefined,
		headerRight: isIos
			? undefined
			: androidFind
				? () => <AndroidFindHeaderRight find={state.find} />
				: () => <AndroidActions state={state} />,
	}
}

function iosMenuGroups(groups: MenuGroup[]) {
	return groups.map((group) => (
		<Stack.Toolbar.Menu inline key={group[0]?.key ?? "group"}>
			{group.map((item) => (
				<Stack.Toolbar.MenuAction
					destructive={item.destructive}
					disabled={item.disabled}
					icon={item.icon?.sf}
					key={item.key}
					onPress={item.onPress}
				>
					{item.label}
				</Stack.Toolbar.MenuAction>
			))}
		</Stack.Toolbar.Menu>
	))
}

export function NoteToolbarIos({ state }: { state: NoteHeaderState }) {
	if (state.find.open) {
		return (
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button onPress={state.find.close} variant="done">
					Done
				</Stack.Toolbar.Button>
			</Stack.Toolbar>
		)
	}
	return (
		<Stack.Toolbar placement="right">
			<Stack.Toolbar.Button
				accessibilityLabel={modeLabel(state.mode)}
				icon={state.mode.icon.sf}
				onPress={state.onCycleMode}
			/>
			<Stack.Toolbar.Menu icon={NOTE_MENU_ICON.sf} title={NOTE_MENU_LABEL}>
				{iosMenuGroups(state.menuGroups)}
			</Stack.Toolbar.Menu>
		</Stack.Toolbar>
	)
}

const styles = StyleSheet.create({
	androidActions: {
		alignItems: "center",
		flexDirection: "row",
	},
})
