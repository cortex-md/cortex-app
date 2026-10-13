import { ListItem, Switch, Text } from "@expo/ui"
import type { LucideIcon } from "lucide-react-native"
import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react-native"
import { Platform, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function SettingsRow({
	Icon,
	chevron = false,
	destructive = false,
	disabled = false,
	onPress,
	onToggle,
	subtitle,
	tint = false,
	title,
	toggled,
	trailing,
	value,
}: {
	Icon?: LucideIcon
	chevron?: boolean
	destructive?: boolean
	disabled?: boolean
	onPress?: () => void
	onToggle?: (value: boolean) => void
	subtitle?: string
	tint?: boolean
	title: string
	toggled?: boolean
	trailing?: ReactNode
	value?: string
}) {
	const { colors } = useMobileColors()
	const titleColor = destructive ? colors.destructiveText : tint ? colors.tint : colors.label
	const supporting = subtitle ?? (!IS_IOS ? value : undefined)

	return (
		<ListItem
			colors={{
				containerColor: colors.cell,
				contentColor: titleColor,
				leadingContentColor: colors.secondaryLabel,
				supportingContentColor: colors.secondaryLabel,
				trailingContentColor: colors.secondaryLabel,
			}}
			leading={Icon ? <Icon color={colors.secondaryLabel} size={IS_IOS ? 20 : 24} strokeWidth={2} /> : undefined}
			onPress={disabled ? undefined : onToggle ? () => onToggle(!toggled) : onPress}
			supportingText={supporting}
			trailing={
				onToggle !== undefined ? (
					<Switch disabled={disabled} label={title} onValueChange={onToggle} value={Boolean(toggled)} />
				) : (
					<View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
						{IS_IOS && value ? <Text textStyle={{ color: colors.secondaryLabel }}>{value}</Text> : null}
						{trailing}
						{chevron ? (
							<ChevronRight color={colors.tertiaryLabel} size={IS_IOS ? 14 : 24} strokeWidth={2.4} />
						) : null}
					</View>
				)
			}
		>
			<Text textStyle={{ color: titleColor }}>{title}</Text>
		</ListItem>
	)
}
