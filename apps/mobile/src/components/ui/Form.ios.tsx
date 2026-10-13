import { FieldGroup } from "@expo/ui"
import { Button, Host, HStack, Image, Spacer, Text, Toggle, VStack } from "@expo/ui/swift-ui"
import {
	background,
	buttonStyle,
	contentShape,
	disabled as disabledModifier,
	font,
	foregroundStyle,
	listRowBackground,
	listRowSeparatorTint,
	scrollContentBackground,
	shapes,
	tint,
} from "@expo/ui/swift-ui/modifiers"

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
					tint(colors.tint),
				]}
			>
				{children}
			</FieldGroup>
		</Host>
	)
}

export function FormSection({ children, footer, title }: FormSectionProps) {
	const { colors } = useMobileColors()
	return (
		<FieldGroup.Section
			modifiers={[listRowBackground(colors.cell), listRowSeparatorTint(colors.separator)]}
			title={title}
		>
			{children}
			{footer ? (
				<FieldGroup.SectionFooter>
					<Text>{footer}</Text>
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
	return (
		<VStack alignment="leading" spacing={2}>
			<Text modifiers={[foregroundStyle(titleColor)]}>{title}</Text>
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
	)
}

export function FormRow({
	chevron = false,
	destructive = false,
	disabled = false,
	icon,
	onPress,
	subtitle,
	tint = false,
	title,
	trailing,
	value,
}: FormRowProps) {
	const { colors } = useMobileColors()
	const titleColor = destructive ? colors.destructiveText : tint ? colors.tint : colors.label
	const content = (
		<HStack modifiers={[contentShape(shapes.rectangle())]} spacing={12}>
			{icon ? (
				<Image color={destructive ? colors.destructiveText : colors.tint} systemName={icon.sf} />
			) : null}
			<RowLabel subtitle={subtitle} title={title} titleColor={titleColor} />
			<Spacer />
			{value ? (
				<Text modifiers={[foregroundStyle({ type: "hierarchical", style: "secondary" })]}>
					{value}
				</Text>
			) : null}
			{trailing}
			{chevron ? (
				<Image
					modifiers={[
						font({ size: 13, weight: "semibold" }),
						foregroundStyle({ type: "hierarchical", style: "tertiary" }),
					]}
					systemName="chevron.right"
				/>
			) : null}
		</HStack>
	)
	if (!onPress) return content
	return (
		<Button modifiers={[buttonStyle("plain"), disabledModifier(disabled)]} onPress={onPress}>
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
	return (
		<Toggle isOn={value} modifiers={[disabledModifier(disabled)]} onIsOnChange={onValueChange}>
			<HStack spacing={12}>
				{icon ? <Image color={colors.tint} systemName={icon.sf} /> : null}
				<RowLabel subtitle={subtitle} title={title} titleColor={colors.label} />
			</HStack>
		</Toggle>
	)
}
