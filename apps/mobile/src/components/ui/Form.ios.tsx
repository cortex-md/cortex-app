import { FieldGroup } from "@expo/ui"
import { Button, Host, HStack, Image, Spacer, Text, Toggle, VStack } from "@expo/ui/swift-ui"
import {
	background,
	buttonStyle,
	contentShape,
	disabled as disabledModifier,
	font,
	foregroundStyle,
	scrollContentBackground,
	shapes,
	tint,
} from "@expo/ui/swift-ui/modifiers"

import { useFormTheme } from "@/components/ui/formTheme"
import type {
	FormRowProps,
	FormSectionProps,
	FormToggleProps,
	NativeFormProps,
} from "@/components/ui/formTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NativeForm({ children }: NativeFormProps) {
	const { colors, scheme } = useMobileColors()
	return (
		<Host colorScheme={scheme} style={{ flex: 1 }} useViewportSizeMeasurement>
			<FieldGroup
				modifiers={[
					scrollContentBackground("hidden"),
					background(colors.groupedBackground),
					foregroundStyle(colors.label),
					tint(colors.tint),
				]}
			>
				{children}
			</FieldGroup>
		</Host>
	)
}

export function FormSection({ children, footer, title }: FormSectionProps) {
	const theme = useFormTheme()
	return (
		<FieldGroup.Section modifiers={theme.row}>
			{title ? (
				<FieldGroup.SectionHeader>
					<Text modifiers={[theme.secondary]}>{title}</Text>
				</FieldGroup.SectionHeader>
			) : null}
			{children}
			{footer ? (
				<FieldGroup.SectionFooter>
					<Text modifiers={[theme.secondary]}>{footer}</Text>
				</FieldGroup.SectionFooter>
			) : null}
		</FieldGroup.Section>
	)
}

function RowLabel({
	subtitle,
	title,
	titleColor,
}: {
	subtitle?: string
	title: string
	titleColor: string
}) {
	const theme = useFormTheme()
	return (
		<VStack alignment="leading" spacing={2}>
			<Text modifiers={[foregroundStyle(titleColor)]}>{title}</Text>
			{subtitle ? (
				<Text modifiers={[font({ textStyle: "footnote" }), theme.secondary]}>{subtitle}</Text>
			) : null}
		</VStack>
	)
}

export function FormRow({
	chevron = false,
	destructive = false,
	disabled = false,
	icon,
	onPress,
	subtitle,
	tint: tinted = false,
	title,
	trailing,
	value,
}: FormRowProps) {
	const { colors } = useMobileColors()
	const theme = useFormTheme()
	const titleColor = destructive ? colors.destructiveText : tinted ? colors.tint : colors.label
	const content = (
		<HStack
			modifiers={[contentShape(shapes.rectangle()), ...(onPress ? [] : theme.row)]}
			spacing={12}
		>
			{icon ? (
				<Image color={destructive ? colors.destructiveText : colors.tint} systemName={icon.sf} />
			) : null}
			<RowLabel subtitle={subtitle} title={title} titleColor={titleColor} />
			<Spacer />
			{value ? <Text modifiers={[theme.secondary]}>{value}</Text> : null}
			{trailing}
			{chevron ? (
				<Image
					modifiers={[font({ size: 13, weight: "semibold" }), theme.tertiary]}
					systemName="chevron.right"
				/>
			) : null}
		</HStack>
	)
	if (!onPress) return content
	return (
		<Button
			modifiers={[buttonStyle("plain"), disabledModifier(disabled), ...theme.row]}
			onPress={onPress}
		>
			{content}
		</Button>
	)
}

export function FormToggle({
	disabled = false,
	icon,
	onValueChange,
	subtitle,
	title,
	value,
}: FormToggleProps) {
	const { colors } = useMobileColors()
	const theme = useFormTheme()
	return (
		<Toggle
			isOn={value}
			modifiers={[theme.toggle, disabledModifier(disabled), ...theme.row]}
			onIsOnChange={onValueChange}
		>
			<HStack spacing={12}>
				{icon ? <Image color={colors.tint} systemName={icon.sf} /> : null}
				<RowLabel subtitle={subtitle} title={title} titleColor={colors.label} />
			</HStack>
		</Toggle>
	)
}
