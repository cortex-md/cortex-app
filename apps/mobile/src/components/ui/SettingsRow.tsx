import type { ReactNode } from "react"

import { FormRow, FormToggle } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"

export function SettingsRow({
	chevron = false,
	destructive = false,
	disabled = false,
	icon,
	onPress,
	onToggle,
	subtitle,
	tint = false,
	title,
	toggled,
	trailing,
	value,
}: {
	chevron?: boolean
	destructive?: boolean
	disabled?: boolean
	icon?: SymbolName
	onPress?: () => void
	onToggle?: (value: boolean) => void
	subtitle?: string
	tint?: boolean
	title: string
	toggled?: boolean
	trailing?: ReactNode
	value?: string
}) {
	if (onToggle) {
		return (
			<FormToggle
				disabled={disabled}
				icon={icon}
				onValueChange={onToggle}
				subtitle={subtitle}
				title={title}
				value={Boolean(toggled)}
			/>
		)
	}
	return (
		<FormRow
			chevron={chevron}
			destructive={destructive}
			disabled={disabled}
			icon={icon}
			onPress={onPress}
			subtitle={subtitle}
			tint={tint}
			title={title}
			trailing={trailing}
			value={value}
		/>
	)
}
