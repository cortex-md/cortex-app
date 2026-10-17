import {
	Column,
	DropdownMenu,
	DropdownMenuItem,
	ListItem,
	RNHostView,
	Row,
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Slider,
	Text,
	TextField,
	useNativeState,
} from "@expo/ui/jetpack-compose"
import { clickable, fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { useRef, useState } from "react"

import {
	useComposeListItemColors,
	useComposeSegmentedColors,
	useComposeSliderColors,
	useComposeTextFieldColors,
} from "@/components/ui/formColors"
import { SymbolIcon } from "@/components/ui/Symbol"
import type {
	SettingsOptionValue,
	SettingsPickerProps,
	SettingsSliderProps,
	SettingsTextFieldProps,
} from "@/features/settings/settingsControlTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function SettingsPicker<T extends SettingsOptionValue>({
	disabled = false,
	onChange,
	options,
	segmented = false,
	title,
	value,
}: SettingsPickerProps<T>) {
	const { colors } = useMobileColors()
	const rowColors = useComposeListItemColors(disabled)
	const segmentedColors = useComposeSegmentedColors()
	const [expanded, setExpanded] = useState(false)
	const selectedLabel = options.find((option) => option.value === value)?.label ?? ""

	if (segmented) {
		return (
			<SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
				{options.map((option) => {
					const selected = option.value === value
					return (
						<SegmentedButton
							colors={segmentedColors}
							key={String(option.value)}
							onClick={() => {
								if (!disabled) onChange(option.value)
							}}
							selected={selected}
						>
							<SegmentedButton.Label>
								<Text color={selected ? colors.tint : colors.secondaryLabel}>{option.label}</Text>
							</SegmentedButton.Label>
						</SegmentedButton>
					)
				})}
			</SingleChoiceSegmentedButtonRow>
		)
	}

	return (
		<ListItem
			colors={rowColors}
			modifiers={disabled ? undefined : [clickable(() => setExpanded(true))]}
		>
			<ListItem.HeadlineContent>
				<Text>{title}</Text>
			</ListItem.HeadlineContent>
			<ListItem.SupportingContent>
				<Text>{selectedLabel}</Text>
			</ListItem.SupportingContent>
			<ListItem.TrailingContent>
				<DropdownMenu
					color={colors.fill}
					expanded={expanded}
					onDismissRequest={() => setExpanded(false)}
				>
					<DropdownMenu.Trigger>
						<RNHostView matchContents>
							<SymbolIcon
								color={colors.secondaryLabel}
								name={{ sf: "chevron.up.chevron.down", md: "arrow_drop_down" }}
								size={24}
							/>
						</RNHostView>
					</DropdownMenu.Trigger>
					<DropdownMenu.Items>
						{options.map((option) => (
							<DropdownMenuItem
								key={String(option.value)}
								onClick={() => {
									setExpanded(false)
									onChange(option.value)
								}}
							>
								<DropdownMenuItem.Text>
									<Text color={option.value === value ? colors.tint : colors.label}>
										{option.label}
									</Text>
								</DropdownMenuItem.Text>
							</DropdownMenuItem>
						))}
					</DropdownMenu.Items>
				</DropdownMenu>
			</ListItem.TrailingContent>
		</ListItem>
	)
}

export function SettingsSlider({
	max,
	min,
	onChange,
	step = 1,
	title,
	value,
	valueLabel,
}: SettingsSliderProps) {
	const { colors } = useMobileColors()
	const sliderColors = useComposeSliderColors()
	return (
		<Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 4 }}>
			<Row horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth()]}>
				<Text color={colors.label}>{title}</Text>
				{valueLabel ? <Text color={colors.secondaryLabel}>{valueLabel}</Text> : null}
			</Row>
			<Slider
				colors={sliderColors}
				max={max}
				min={min}
				onValueChange={(next) => {
					const rounded = Math.round(next / step) * step
					if (rounded !== value) onChange(rounded)
				}}
				steps={Math.max(0, Math.round((max - min) / step) - 1)}
				value={value}
			/>
		</Column>
	)
}

export function SettingsTextField({
	defaultValue,
	numeric = false,
	onCommit,
	placeholder,
	subtitle,
	title,
}: SettingsTextFieldProps) {
	const text = useNativeState(defaultValue)
	const latest = useRef(defaultValue)
	const fieldColors = useComposeTextFieldColors()
	return (
		<TextField
			colors={fieldColors}
			keyboardActions={{ onDone: (next) => onCommit(next) }}
			keyboardOptions={{
				autoCorrectEnabled: false,
				capitalization: "none",
				imeAction: "done",
				keyboardType: numeric ? "decimal" : "text",
			}}
			modifiers={[fillMaxWidth()]}
			onFocusChanged={(focused) => {
				if (!focused) onCommit(latest.current)
			}}
			onValueChange={(next) => {
				latest.current = next
			}}
			singleLine
			value={text}
		>
			<TextField.Label>
				<Text>{title}</Text>
			</TextField.Label>
			{placeholder ? (
				<TextField.Placeholder>
					<Text>{placeholder}</Text>
				</TextField.Placeholder>
			) : null}
			{subtitle ? (
				<TextField.SupportingText>
					<Text>{subtitle}</Text>
				</TextField.SupportingText>
			) : null}
		</TextField>
	)
}
