import { Link } from "expo-router"
import { cloneElement, type ReactElement } from "react"
import {
	type PressableStateCallbackType,
	type StyleProp,
	StyleSheet,
	type ViewStyle,
} from "react-native"

import type { EntryContextMenuProps } from "@/features/file-explorer/entryContextMenuTypes"

type TriggerStyle =
	| StyleProp<ViewStyle>
	| ((state: PressableStateCallbackType) => StyleProp<ViewStyle>)

function withFlatStyle(element: ReactElement) {
	const { style } = element.props as { style?: TriggerStyle }
	const resolved = typeof style === "function" ? style({ hovered: false, pressed: false }) : style
	return cloneElement(element as ReactElement<{ style?: ViewStyle }>, {
		style: StyleSheet.flatten(resolved),
	})
}

export function EntryContextMenu({
	children,
	groups,
	header,
	href,
	onPress,
}: EntryContextMenuProps) {
	if (groups.length === 0) return children({ onPress })
	return (
		<Link
			asChild
			href={href}
			onPress={(event) => {
				event.preventDefault()
				onPress()
			}}
		>
			<Link.Trigger>{withFlatStyle(children({}))}</Link.Trigger>
			<Link.Menu title={header}>
				{groups.map((group, index) => (
					<Link.Menu inline key={group[0]?.key ?? index}>
						{group.map((item) => (
							<Link.MenuAction
								destructive={item.destructive}
								disabled={item.disabled}
								icon={item.icon?.sf}
								isOn={item.checked}
								key={item.key}
								onPress={item.onPress}
								subtitle={item.subtitle}
								title={item.label}
							/>
						))}
					</Link.Menu>
				))}
			</Link.Menu>
		</Link>
	)
}
