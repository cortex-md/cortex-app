import {
	Button,
	Divider,
	Image,
	Menu,
	SecureField,
	Text,
	TextField,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui"
import {
	autocorrectionDisabled,
	buttonStyle,
	font,
	keyboardType,
	onSubmit as onSubmitModifier,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers"
import { Fragment } from "react"

import { useFormTheme } from "@/components/ui/formTheme"
import type {
	FormCheckProps,
	FormKeyboard,
	FormMenuProps,
	FormTextFieldProps,
} from "@/features/sync/formControlTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function keyboardFor(keyboard: FormKeyboard) {
	if (keyboard === "email") return keyboardType("email-address")
	if (keyboard === "url") return keyboardType("url")
	return keyboardType("default")
}

export function FormTextField({
	autoFocus = false,
	initialValue = "",
	keyboard = "default",
	label,
	monospace = false,
	onChangeText,
	onCommit,
	onSubmit,
	placeholder,
	secure = false,
}: FormTextFieldProps) {
	const text = useNativeState(initialValue)
	const theme = useFormTheme()
	const plain = keyboard !== "default" || secure
	const modifiers = [
		textInputAutocapitalization(plain ? "never" : "sentences"),
		autocorrectionDisabled(plain),
		keyboardFor(keyboard),
		onSubmitModifier(() => {
			onCommit?.(text.value)
			onSubmit?.()
		}),
		...(monospace ? [font({ design: "monospaced", size: 15 })] : []),
		...(label ? [] : theme.row),
	]
	const handleChange = (value: string) => {
		onChangeText?.(value)
	}
	const handleFocus = (focused: boolean) => {
		if (!focused) onCommit?.(text.value)
	}
	const field = secure ? (
		<SecureField
			autoFocus={autoFocus}
			modifiers={modifiers}
			onFocusChange={handleFocus}
			onTextChange={handleChange}
			placeholder={placeholder}
			text={text}
		/>
	) : (
		<TextField
			autoFocus={autoFocus}
			modifiers={modifiers}
			onFocusChange={handleFocus}
			onTextChange={handleChange}
			placeholder={placeholder}
			text={text}
		/>
	)
	if (!label) return field
	return (
		<VStack alignment="leading" modifiers={theme.row} spacing={4}>
			<Text modifiers={[font({ textStyle: "footnote" }), theme.secondary]}>{label}</Text>
			{field}
		</VStack>
	)
}

export function FormMenu({ accessibilityLabel, groups, label }: FormMenuProps) {
	const theme = useFormTheme()
	return (
		<Menu
			label={<Text modifiers={[theme.accent]}>{label}</Text>}
			modifiers={[buttonStyle("borderless")]}
			testID={accessibilityLabel}
		>
			{groups.map((group, groupIndex) => (
				<Fragment key={groupIndex}>
					{groupIndex > 0 ? <Divider /> : null}
					{group.map((item) => (
						<Button
							key={item.key}
							label={item.label}
							onPress={item.disabled ? undefined : item.onPress}
							role={item.destructive ? "destructive" : "default"}
							systemImage={item.checked ? "checkmark" : item.icon?.sf}
						/>
					))}
				</Fragment>
			))}
		</Menu>
	)
}

export function FormCheck({ checked }: FormCheckProps) {
	const { colors } = useMobileColors()
	if (!checked) return null
	return (
		<Image
			color={colors.tint}
			modifiers={[font({ size: 15, weight: "semibold" })]}
			systemName="checkmark"
		/>
	)
}
