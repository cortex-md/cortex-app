import {
	Button,
	Column,
	DropdownMenu,
	DropdownMenuItem,
	FilledTonalButton,
	ListItem,
	RNHostView,
	Text,
	TextButton,
} from "@expo/ui/jetpack-compose"
import { clickable, fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { MobileTextField } from "@/components/ui/MobileTextField"
import { SymbolIcon } from "@/components/ui/Symbol"
import type {
	FormButtonProps,
	FormCheckRowProps,
	FormHeaderProps,
	FormPickerProps,
	FormTextFieldProps,
} from "@/features/onboarding/formControlTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function useRowColors() {
	const { colors } = useMobileColors()
	return {
		containerColor: colors.cell,
		contentColor: colors.label,
		leadingContentColor: colors.secondaryLabel,
		supportingContentColor: colors.secondaryLabel,
		trailingContentColor: colors.secondaryLabel,
	}
}

export function FormTextField({
	autoCapitalize = "sentences",
	autoFocus = false,
	defaultValue = "",
	keyboard = "default",
	label,
	onChangeText,
	onSubmit,
	placeholder,
	secure = false,
}: FormTextFieldProps) {
	return (
		<RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}>
			<View style={styles.field}>
				<MobileTextField
					accessibilityLabel={label}
					autoCapitalize={autoCapitalize}
					autoCorrect={autoCapitalize !== "none" && keyboard !== "email"}
					autoFocus={autoFocus}
					defaultValue={defaultValue}
					keyboardType={keyboard === "email" ? "email-address" : "default"}
					label={label}
					onChangeText={onChangeText}
					onSubmitText={onSubmit ? () => onSubmit() : undefined}
					placeholder={placeholder}
					returnKeyType={onSubmit ? "done" : "default"}
					secureTextEntry={secure}
				/>
			</View>
		</RNHostView>
	)
}

export function FormPicker<T extends string>({
	icon,
	label,
	onChange,
	options,
	value,
}: FormPickerProps<T>) {
	const { colors } = useMobileColors()
	const rowColors = useRowColors()
	const [expanded, setExpanded] = useState(false)
	const selected = options.find((option) => option.value === value)
	return (
		<DropdownMenu
			color={colors.elevated}
			expanded={expanded}
			onDismissRequest={() => setExpanded(false)}
		>
			<DropdownMenu.Trigger>
				<ListItem colors={rowColors} modifiers={[clickable(() => setExpanded(true))]}>
					<ListItem.HeadlineContent>
						<Text>{label}</Text>
					</ListItem.HeadlineContent>
					{selected ? (
						<ListItem.SupportingContent>
							<Text>{selected.label}</Text>
						</ListItem.SupportingContent>
					) : null}
					{icon ? (
						<ListItem.LeadingContent>
							<RNHostView matchContents>
								<SymbolIcon color={colors.secondaryLabel} name={icon} size={24} />
							</RNHostView>
						</ListItem.LeadingContent>
					) : null}
					<ListItem.TrailingContent>
						<RNHostView matchContents>
							<SymbolIcon
								color={colors.tertiaryLabel}
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
								color={String(option.value === value ? colors.tint : colors.label)}
								style={{ typography: "bodyLarge" }}
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

export function FormButton({
	disabled = false,
	label,
	onPress,
	variant = "primary",
}: FormButtonProps) {
	const content = <Text style={{ typography: "labelLarge" }}>{label}</Text>
	const modifiers = [fillMaxWidth()]
	if (variant === "primary") {
		return (
			<Button enabled={!disabled} modifiers={modifiers} onClick={onPress}>
				{content}
			</Button>
		)
	}
	if (variant === "secondary") {
		return (
			<FilledTonalButton enabled={!disabled} modifiers={modifiers} onClick={onPress}>
				{content}
			</FilledTonalButton>
		)
	}
	return (
		<TextButton enabled={!disabled} modifiers={modifiers} onClick={onPress}>
			{content}
		</TextButton>
	)
}

export function FormHeader({ subtitle, title }: FormHeaderProps) {
	const { colors } = useMobileColors()
	return (
		<Column
			modifiers={[fillMaxWidth(), padding(0, 16, 0, 8)]}
			verticalArrangement={{ spacedBy: 8 }}
		>
			<Text color={String(colors.label)} style={{ typography: "headlineMedium" }}>
				{title}
			</Text>
			{subtitle ? (
				<Text color={String(colors.secondaryLabel)} style={{ typography: "bodyLarge" }}>
					{subtitle}
				</Text>
			) : null}
		</Column>
	)
}

export function FormCheckRow({
	checked,
	disabled = false,
	icon,
	iconColor,
	onPress,
	subtitle,
	title,
	value,
}: FormCheckRowProps) {
	const { colors } = useMobileColors()
	const rowColors = useRowColors()
	const supporting = subtitle ?? value
	return (
		<ListItem colors={rowColors} modifiers={disabled ? undefined : [clickable(onPress)]}>
			<ListItem.HeadlineContent>
				<Text color={String(disabled ? colors.secondaryLabel : colors.label)}>{title}</Text>
			</ListItem.HeadlineContent>
			{supporting ? (
				<ListItem.SupportingContent>
					<Text>{supporting}</Text>
				</ListItem.SupportingContent>
			) : null}
			{icon ? (
				<ListItem.LeadingContent>
					<RNHostView matchContents>
						<SymbolIcon color={iconColor ?? colors.secondaryLabel} name={icon} size={24} />
					</RNHostView>
				</ListItem.LeadingContent>
			) : null}
			{checked ? (
				<ListItem.TrailingContent>
					<RNHostView matchContents>
						<SymbolIcon color={colors.tint} name={{ md: "check", sf: "checkmark" }} size={24} />
					</RNHostView>
				</ListItem.TrailingContent>
			) : null}
		</ListItem>
	)
}

const styles = StyleSheet.create({
	field: {
		paddingVertical: 4,
	},
})
