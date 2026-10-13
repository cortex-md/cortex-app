import {
	Column,
	Host,
	LazyColumn,
	ListItem,
	RNHostView,
	Switch,
	Text,
} from "@expo/ui/jetpack-compose"
import {
	background,
	clickable,
	clip,
	fillMaxWidth,
	padding,
	Shapes,
} from "@expo/ui/jetpack-compose/modifiers"

import type {
	FormRowProps,
	FormSectionProps,
	FormToggleProps,
	NativeFormProps,
} from "@/components/ui/formTypes"
import { Symbol } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NativeForm({ children }: NativeFormProps) {
	const { colors, scheme } = useMobileColors()
	return (
		<Host colorScheme={scheme} seedColor={colors.tintFill} style={{ flex: 1 }}>
			<LazyColumn
				contentPadding={{ bottom: 32, end: 16, start: 16, top: 16 }}
				modifiers={[background(colors.groupedBackground)]}
				verticalArrangement={{ spacedBy: 24 }}
			>
				{children}
			</LazyColumn>
		</Host>
	)
}

export function FormSection({ children, footer, title }: FormSectionProps) {
	const { colors } = useMobileColors()
	return (
		<Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 8 }}>
			{title ? (
				<Column modifiers={[padding(16, 0, 16, 0)]}>
					<Text color={String(colors.tint)} style={{ typography: "titleSmall" }}>
						{title}
					</Text>
				</Column>
			) : null}
			<Column
				modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(20))]}
				verticalArrangement={{ spacedBy: 2 }}
			>
				{children}
			</Column>
			{footer ? (
				<Column modifiers={[padding(16, 0, 16, 0)]}>
					<Text color={String(colors.secondaryLabel)} style={{ typography: "bodySmall" }}>
						{footer}
					</Text>
				</Column>
			) : null}
		</Column>
	)
}

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
	const rowColors = useRowColors()
	const titleColor = destructive ? colors.destructiveText : tint ? colors.tint : colors.label
	const supporting = subtitle ?? value
	return (
		<ListItem
			colors={rowColors}
			modifiers={onPress && !disabled ? [clickable(onPress)] : undefined}
		>
			<ListItem.HeadlineContent>
				<Text color={String(titleColor)}>{title}</Text>
			</ListItem.HeadlineContent>
			{supporting ? (
				<ListItem.SupportingContent>
					<Text>{supporting}</Text>
				</ListItem.SupportingContent>
			) : null}
			{icon ? (
				<ListItem.LeadingContent>
					<RNHostView matchContents>
						<Symbol
							color={destructive ? colors.destructiveText : colors.secondaryLabel}
							name={icon}
							size={24}
						/>
					</RNHostView>
				</ListItem.LeadingContent>
			) : null}
			{trailing || chevron || (subtitle && value) ? (
				<ListItem.TrailingContent>
					{trailing ?? (subtitle && value && !chevron ? <Text>{value}</Text> : null) ?? (
						<RNHostView matchContents>
							<Symbol
								color={colors.tertiaryLabel}
								name={{ sf: "chevron.right", md: "chevron_right" }}
								size={24}
							/>
						</RNHostView>
					)}
				</ListItem.TrailingContent>
			) : null}
		</ListItem>
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
	const rowColors = useRowColors()
	return (
		<ListItem
			colors={rowColors}
			modifiers={disabled ? undefined : [clickable(() => onValueChange(!value))]}
		>
			<ListItem.HeadlineContent>
				<Text>{title}</Text>
			</ListItem.HeadlineContent>
			{subtitle ? (
				<ListItem.SupportingContent>
					<Text>{subtitle}</Text>
				</ListItem.SupportingContent>
			) : null}
			{icon ? (
				<ListItem.LeadingContent>
					<RNHostView matchContents>
						<Symbol color={colors.secondaryLabel} name={icon} size={24} />
					</RNHostView>
				</ListItem.LeadingContent>
			) : null}
			<ListItem.TrailingContent>
				<Switch enabled={!disabled} onCheckedChange={onValueChange} value={value} />
			</ListItem.TrailingContent>
		</ListItem>
	)
}
