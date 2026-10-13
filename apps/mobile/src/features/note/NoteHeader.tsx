import type { EditorMode } from "@cortex/core"
import type { NativeStackNavigationOptions } from "expo-router"
import { Stack } from "expo-router"
import { BookOpen, Check, Code, Eye, type LucideIcon, MoreVertical } from "lucide-react-native"
import { StyleSheet, View } from "react-native"

import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuGroup, SFSymbol } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import {
	AndroidFindHeaderLeft,
	AndroidFindHeaderRight,
	AndroidFindHeaderTitle,
} from "@/features/note/FindBar"
import { NOTE_MENU_LABEL } from "@/features/note/noteMenu"
import { NoteTitleView } from "@/features/note/NoteTitleView"
import type { FindInNote } from "@/features/note/useFindInNote"
import type { MobileColors } from "@/theme/colors"

export interface ModePresentation {
	label: string
	sf: SFSymbol
	Icon: LucideIcon
	next: EditorMode
}

const modePresentations: Record<"live-preview" | "source" | "reading", ModePresentation> = {
	"live-preview": { label: "Preview", sf: "eye", Icon: Eye, next: "source" },
	source: {
		label: "Source",
		sf: "chevron.left.forwardslash.chevron.right",
		Icon: Code,
		next: "reading",
	},
	reading: { label: "Reading", sf: "book", Icon: BookOpen, next: "live-preview" },
}

export function getModePresentation(mode: EditorMode): ModePresentation {
	return mode === "source" || mode === "reading"
		? modePresentations[mode]
		: modePresentations["live-preview"]
}

export interface NoteHeaderState {
	colors: MobileColors
	editing: boolean
	find: FindInNote
	live: boolean
	liveCount: number
	menuGroups: MenuGroup[]
	mode: ModePresentation
	onCycleMode: () => void
	onDone: () => void
	title: string
}

function modeLabel(mode: ModePresentation): string {
	return `Editor mode: ${mode.label}. Tap to switch.`
}

function AndroidActions({ state }: { state: NoteHeaderState }) {
	if (state.editing) {
		return (
			<HeaderIconButton Icon={Check} accessibilityLabel="Done" onPress={state.onDone} prominent />
		)
	}
	return (
		<View style={styles.androidActions}>
			<HeaderIconButton
				Icon={state.mode.Icon}
				accessibilityLabel={modeLabel(state.mode)}
				onPress={state.onCycleMode}
			/>
			<NativeMenu
				accessibilityLabel={NOTE_MENU_LABEL}
				groups={state.menuGroups}
				icon={{ sf: "ellipsis", Lucide: MoreVertical }}
			/>
		</View>
	)
}

export function buildNoteScreenOptions(
	state: NoteHeaderState,
	isIos: boolean,
): NativeStackNavigationOptions {
	const androidFind = !isIos && state.find.open
	const title = () => (
		<NoteTitleView
			editing={state.editing}
			live={state.live}
			liveCount={state.liveCount}
			title={state.title}
		/>
	)
	return {
		headerBackButtonDisplayMode: "minimal",
		headerLargeTitleEnabled: false,
		headerShadowVisible: false,
		headerStyle: { backgroundColor: state.colors.background },
		headerTransparent: false,
		title: state.title,
		headerTitle: androidFind ? () => <AndroidFindHeaderTitle find={state.find} /> : title,
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
	if (state.editing) {
		return (
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button icon="checkmark" onPress={state.onDone} variant="prominent" />
			</Stack.Toolbar>
		)
	}
	return (
		<Stack.Toolbar placement="right">
			<Stack.Toolbar.Button
				accessibilityLabel={modeLabel(state.mode)}
				icon={state.mode.sf}
				onPress={state.onCycleMode}
			/>
			<Stack.Toolbar.Menu icon="ellipsis" title={NOTE_MENU_LABEL}>
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
