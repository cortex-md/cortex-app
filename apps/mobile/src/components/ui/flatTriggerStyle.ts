import { cloneElement, type ReactElement } from "react"
import {
	type PressableStateCallbackType,
	type StyleProp,
	StyleSheet,
	type ViewStyle,
} from "react-native"

type TriggerStyle =
	| StyleProp<ViewStyle>
	| ((state: PressableStateCallbackType) => StyleProp<ViewStyle>)

export function withFlatTriggerStyle(element: ReactElement): ReactElement {
	const { style } = element.props as { style?: TriggerStyle }
	const resolved = typeof style === "function" ? style({ hovered: false, pressed: false }) : style
	return cloneElement(element as ReactElement<{ style?: ViewStyle }>, {
		style: StyleSheet.flatten(resolved),
	})
}
