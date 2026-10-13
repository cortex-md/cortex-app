import {
	Button,
	HStack,
	Image,
	Picker,
	SecureField,
	Spacer,
	Text,
	TextField,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui"
import {
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	controlSize,
	disabled as disabledModifier,
	font,
	foregroundStyle,
	frame,
	keyboardType,
	listRowBackground,
	listRowInsets,
	listRowSeparator,
	onSubmit,
	pickerStyle,
	shapes,
	submitLabel,
	tag,
	textContentType,
	textInputAutocapitalization,
	tint,
} from "@expo/ui/swift-ui/modifiers"

import type {
	FormButtonProps,
	FormCheckRowProps,
	FormHeaderProps,
	FormPickerProps,
	FormTextFieldProps,
} from "@/features/onboarding/formControlTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

const FULL_WIDTH = 10000

export function FormTextField({
	autoCapitalize = "sentences",
	autoFocus = false,
	defaultValue = "",
	keyboard = "default",
	label,
	onChangeText,
	onSubmit: handleSubmit,
	placeholder,
	secure = false,
}: FormTextFieldProps) {
	const text = useNativeState(defaultValue)
	const modifiers = [
		textInputAutocapitalization(autoCapitalize === "none" ? "never" : autoCapitalize),
		autocorrectionDisabled(autoCapitalize === "none" || keyboard === "email"),
		keyboardType(keyboard === "email" ? "email-address" : "default"),
		...(keyboard === "email" ? [textContentType("emailAddress")] : []),
		submitLabel(handleSubmit ? "done" : "return"),
		...(handleSubmit ? [onSubmit(handleSubmit)] : []),
	]
	if (secure) {
		return (
			<SecureField
				autoFocus={autoFocus}
				modifiers={modifiers}
				onTextChange={onChangeText}
				placeholder={placeholder ?? label}
				text={text}
			/>
		)
	}
	return (
		<TextField
			autoFocus={autoFocus}
			modifiers={modifiers}
			onTextChange={onChangeText}
			placeholder={placeholder ?? label}
			text={text}
		/>
	)
}

export function FormPicker<T extends string>({
	icon,
	label,
	onChange,
	options,
	value,
}: FormPickerProps<T>) {
	return (
		<Picker
			label={label}
			modifiers={[pickerStyle("menu")]}
			onSelectionChange={(selection) => onChange(selection as T)}
			selection={value}
			systemImage={icon?.sf}
		>
			{options.map((option) => (
				<Text key={option.value} modifiers={[tag(option.value)]}>
					{option.label}
				</Text>
			))}
		</Picker>
	)
}

export function FormButton({
	disabled = false,
	label,
	onPress,
	variant = "primary",
}: FormButtonProps) {
	const { colors } = useMobileColors()
	const style =
		variant === "primary" ? "glassProminent" : variant === "secondary" ? "glass" : "borderless"
	return (
		<Button
			modifiers={[
				buttonStyle(style),
				controlSize("large"),
				disabledModifier(disabled),
				...(variant === "primary" ? [tint(colors.tintFill)] : [foregroundStyle(colors.label)]),
				listRowBackground("clear"),
				listRowSeparator("hidden"),
				listRowInsets({ bottom: 4, leading: 0, top: 4, trailing: 0 }),
			]}
			onPress={onPress}
		>
			<Text modifiers={[frame({ maxWidth: FULL_WIDTH }), font({ weight: "semibold" })]}>
				{label}
			</Text>
		</Button>
	)
}

export function FormHeader({ subtitle, title }: FormHeaderProps) {
	return (
		<VStack
			alignment="leading"
			modifiers={[
				frame({ alignment: "leading", maxWidth: FULL_WIDTH }),
				listRowBackground("clear"),
				listRowInsets({ bottom: 8, leading: 0, top: 24, trailing: 0 }),
			]}
			spacing={6}
		>
			<Text modifiers={[font({ textStyle: "largeTitle", weight: "bold" })]}>{title}</Text>
			{subtitle ? (
				<Text modifiers={[foregroundStyle({ type: "hierarchical", style: "secondary" })]}>
					{subtitle}
				</Text>
			) : null}
		</VStack>
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
	return (
		<Button modifiers={[buttonStyle("plain"), disabledModifier(disabled)]} onPress={onPress}>
			<HStack modifiers={[contentShape(shapes.rectangle())]} spacing={12}>
				{icon ? <Image color={iconColor ?? colors.tint} systemName={icon.sf} /> : null}
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[foregroundStyle(disabled ? colors.secondaryLabel : colors.label)]}>
						{title}
					</Text>
					{subtitle ? (
						<Text
							modifiers={[
								font({ textStyle: "footnote" }),
								foregroundStyle({ type: "hierarchical", style: "secondary" }),
							]}
						>
							{subtitle}
						</Text>
					) : null}
				</VStack>
				<Spacer />
				{value ? (
					<Text modifiers={[foregroundStyle({ type: "hierarchical", style: "secondary" })]}>
						{value}
					</Text>
				) : null}
				{checked ? (
					<Image
						color={colors.tint}
						modifiers={[font({ weight: "semibold" })]}
						systemName="checkmark"
					/>
				) : null}
			</HStack>
		</Button>
	)
}
