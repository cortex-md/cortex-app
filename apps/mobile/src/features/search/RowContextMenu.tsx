import { type Href, Link } from "expo-router"
import type { SFSymbol } from "expo-symbols"
import type { ReactElement } from "react"
import { Platform } from "react-native"

import { withFlatTriggerStyle } from "@/components/ui/flatTriggerStyle"

export interface RowMenuAction {
	key: string
	label: string
	icon?: SFSymbol
	destructive?: boolean
	isOn?: boolean
	onPress: () => void
}

export interface RowMenuSubmenu {
	key: string
	label: string
	icon?: SFSymbol
	actions: RowMenuAction[]
}

export type RowMenuEntry = RowMenuAction | RowMenuSubmenu

function isSubmenu(entry: RowMenuEntry): entry is RowMenuSubmenu {
	return "actions" in entry
}

function renderAction(action: RowMenuAction) {
	return (
		<Link.MenuAction
			destructive={action.destructive}
			icon={action.icon}
			isOn={action.isOn}
			key={action.key}
			onPress={action.onPress}
		>
			{action.label}
		</Link.MenuAction>
	)
}

export function RowContextMenu({
	children,
	entries,
	href,
	onPress,
}: {
	children: (onPress: (() => void) | undefined) => ReactElement
	entries: RowMenuEntry[]
	href: Href
	onPress: () => void
}) {
	if (Platform.OS !== "ios") return children(onPress)
	return (
		<Link
			asChild
			href={href}
			onPress={(event) => {
				event.preventDefault()
				onPress()
			}}
		>
			<Link.Trigger>{withFlatTriggerStyle(children(undefined))}</Link.Trigger>
			<Link.Menu>
				{entries.map((entry) =>
					isSubmenu(entry) ? (
						<Link.Menu icon={entry.icon} key={entry.key} title={entry.label}>
							{entry.actions.map(renderAction)}
						</Link.Menu>
					) : (
						renderAction(entry)
					),
				)}
			</Link.Menu>
		</Link>
	)
}
