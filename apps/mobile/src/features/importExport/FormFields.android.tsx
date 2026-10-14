import {
	DropdownMenu,
	DropdownMenuItem,
	LinearProgressIndicator,
	ListItem,
	OutlinedTextField,
	RadioButton,
	RNHostView,
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Text,
	useNativeState,
} from "@expo/ui/jetpack-compose"
import { clickable, fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { useState } from "react"

import {
	useComposeListItemColors,
	useComposeRadioColors,
	useComposeSegmentedColors,
	useComposeTextFieldColors,
} from "@/components/ui/formColors"
import { SymbolIcon } from "@/components/ui/Symbol"
import type {
	FormChoiceRowProps,
	FormPickerProps,
	FormProgressProps,
	FormTextFieldProps,
	FormTextProps,
} from "@/features/importExport/formFieldTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function FormTextField({
	disabled = false,
	initialValue,
	label,
	monospace = false,
	multiline = false,
	onChangeText,
	placeholder,
}: FormTextFieldProps) {
	const value = useNativeState(initialValue)
	const fieldColors = useComposeTextFieldColors()
	return (
		<OutlinedTextField
			colors={{
				...fieldColors,
				focusedContainerColor: "transparent",
				unfocusedContainerColor: "transparent",
			}}
			enabled={!disabled}
			keyboardOptions={
				monospace
					? { autoCorrectEnabled: false, capitalization: "none" }
					: { capitalization: "sentences" }
			}
			maxLines={multiline ? 6 : 1}
			minLines={multiline ? 2 : 1}
			modifiers={[fillMaxWidth()]}
			onValueChange={onChangeText}
			singleLine={!multiline}
			textStyle={monospace ? { fontFamily: "monospace" } : undefined}
			value={value}
		>
			<OutlinedTextField.Label>
				<Text>{label}</Text>
			</OutlinedTextField.Label>
			{placeholder ? (
				<OutlinedTextField.Placeholder>
					<Text>{placeholder}</Text>
				</OutlinedTextField.Placeholder>
			) : null}
		</OutlinedTextField>
	)
}

export function FormPicker<T extends string>({
	label,
	onChange,
	options,
	segmented = false,
	value,
}: FormPickerProps<T>) {
	const { colors } = useMobileColors()
	const rowColors = useComposeListItemColors()
	const segmentedColors = useComposeSegmentedColors()
	const [expanded, setExpanded] = useState(false)
	const selected = options.find((option) => option.value === value)

	if (segmented) {
		return (
			<SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
				{options.map((option) => (
					<SegmentedButton
						colors={segmentedColors}
						key={option.value}
						onClick={() => onChange(option.value)}
						selected={option.value === value}
					>
						<SegmentedButton.Label>
							<Text color={String(option.value === value ? colors.tint : colors.secondaryLabel)}>
								{option.label}
							</Text>
						</SegmentedButton.Label>
					</SegmentedButton>
				))}
			</SingleChoiceSegmentedButtonRow>
		)
	}

	return (
		<DropdownMenu
			color={colors.fill}
			expanded={expanded}
			onDismissRequest={() => setExpanded(false)}
		>
			<DropdownMenu.Trigger>
				<ListItem colors={rowColors} modifiers={[clickable(() => setExpanded(true))]}>
					<ListItem.HeadlineContent>
						<Text>{label}</Text>
					</ListItem.HeadlineContent>
					<ListItem.SupportingContent>
						<Text>{selected?.label ?? ""}</Text>
					</ListItem.SupportingContent>
					<ListItem.TrailingContent>
						<RNHostView matchContents>
							<SymbolIcon
								color={colors.secondaryLabel}
								name={{ md: "arrow_drop_down", sf: "chevron.up.chevron.down" }}
								size={24}
							/>
						</RNHostView>
					</ListItem.TrailingContent>
				</ListItem>
			</DropdownMenu.Trigger>
			<DropdownMenu.Items>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => {
							setExpanded(false)
							onChange(option.value)
						}}
					>
						<DropdownMenuItem.Text>
							<Text
								color={option.value === value ? String(colors.tint) : String(colors.label)}
								style={{ typography: "bodyMedium" }}
							>
								{option.label}
							</Text>
						</DropdownMenuItem.Text>
					</DropdownMenuItem>
				))}
			</DropdownMenu.Items>
		</DropdownMenu>
	)
}

export function FormChoiceRow({
	disabled = false,
	icon,
	onPress,
	selected,
	subtitle,
	title,
}: FormChoiceRowProps) {
	const { colors } = useMobileColors()
	const rowColors = useComposeListItemColors(disabled)
	const radioColors = useComposeRadioColors()
	return (
		<ListItem colors={rowColors} modifiers={disabled ? undefined : [clickable(onPress)]}>
			<ListItem.HeadlineContent>
				<Text>{title}</Text>
			</ListItem.HeadlineContent>
			{subtitle ? (
				<ListItem.SupportingContent>
					<Text>{subtitle}</Text>
				</ListItem.SupportingContent>
			) : null}
			<ListItem.LeadingContent>
				<RadioButton
					colors={radioColors}
					enabled={!disabled}
					onClick={onPress}
					selected={selected}
				/>
			</ListItem.LeadingContent>
			{icon ? (
				<ListItem.TrailingContent>
					<RNHostView matchContents>
						<SymbolIcon color={colors.secondaryLabel} name={icon} size={24} />
					</RNHostView>
				</ListItem.TrailingContent>
			) : null}
		</ListItem>
	)
}

export function FormProgress({ label, value }: FormProgressProps) {
	const { colors } = useMobileColors()
	const rowColors = useComposeListItemColors()
	return (
		<ListItem colors={rowColors}>
			<ListItem.HeadlineContent>
				<LinearProgressIndicator
					color={colors.tintFill}
					modifiers={[fillMaxWidth()]}
					progress={value}
					trackColor={colors.fill}
				/>
			</ListItem.HeadlineContent>
			<ListItem.SupportingContent>
				<Text>{label}</Text>
			</ListItem.SupportingContent>
		</ListItem>
	)
}

export function FormText({ monospace = false, secondary = false, text }: FormTextProps) {
	const { colors } = useMobileColors()
	return (
		<Text
			color={String(secondary ? colors.secondaryLabel : colors.label)}
			style={{ fontFamily: monospace ? "monospace" : undefined, typography: "bodyMedium" }}
		>
			{text}
		</Text>
	)
}
