import type { StyleProp, ViewStyle } from "react-native"

export interface SegmentedOption<T extends string> {
	label: string
	value: T
}

export interface SegmentedControlProps<T extends string> {
	accessibilityLabel?: string
	onChange: (value: T) => void
	options: SegmentedOption<T>[]
	style?: StyleProp<ViewStyle>
	value: T
}
