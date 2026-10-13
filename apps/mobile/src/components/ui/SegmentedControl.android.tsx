import { Host } from "@expo/ui"
import { SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"

import type { SegmentedControlProps } from "@/components/ui/segmentedTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function SegmentedControl<T extends string>({
	onChange,
	options,
	style,
	value,
}: SegmentedControlProps<T>) {
	const { colors } = useMobileColors()

	return (
		<Host matchContents style={style}>
			<SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
				{options.map((option) => {
					const selected = option.value === value
					return (
						<SegmentedButton
							colors={{
								activeBorderColor: colors.border,
								activeContainerColor: colors.accentSubtle,
								activeContentColor: colors.tint,
								inactiveBorderColor: colors.border,
								inactiveContainerColor: "transparent",
								inactiveContentColor: colors.secondaryLabel,
							}}
							key={option.value}
							onClick={() => onChange(option.value)}
							selected={selected}
						>
							<SegmentedButton.Label>
								<Text color={selected ? colors.tint : colors.secondaryLabel}>{option.label}</Text>
							</SegmentedButton.Label>
						</SegmentedButton>
					)
				})}
			</SingleChoiceSegmentedButtonRow>
		</Host>
	)
}
