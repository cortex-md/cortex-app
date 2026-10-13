import { Host } from "@expo/ui"
import { Picker, Text } from "@expo/ui/swift-ui"
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers"

import type { SegmentedControlProps } from "@/components/ui/segmentedTypes"

export function SegmentedControl<T extends string>({
	accessibilityLabel,
	onChange,
	options,
	style,
	value,
}: SegmentedControlProps<T>) {
	return (
		<Host matchContents style={style}>
			<Picker
				modifiers={[pickerStyle("segmented")]}
				onSelectionChange={(selection) => onChange(selection as T)}
				selection={value}
				testID={accessibilityLabel}
			>
				{options.map((option) => (
					<Text key={option.value} modifiers={[tag(option.value)]}>
						{option.label}
					</Text>
				))}
			</Picker>
		</Host>
	)
}
