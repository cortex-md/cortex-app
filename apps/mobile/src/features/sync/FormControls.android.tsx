import {
	DropdownMenu,
	DropdownMenuItem,
	HorizontalDivider,
	RNHostView,
	Text,
	TextButton,
	TextField,
	useNativeState,
} from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { Fragment, useState } from "react"

import { SymbolIcon } from "@/components/ui/Symbol"
import type {
	FormCheckProps,
	FormKeyboard,
	FormMenuProps,
	FormTextFieldProps,
} from "@/features/sync/formControlTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function keyboardFor(keyboard: FormKeyboard, secure: boolean) {
	if (secure) return "password" as const
	if (keyboard === "email") return "email" as const
	if (keyboard === "url") return "uri" as const
	return "text" as const
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
	const { colors } = useMobileColors()
	const value = useNativeState(initialValue)
	const plain = keyboard !== "default" || secure
	const submit = () => {
		onCommit?.(value.value)
		onSubmit?.()
	}
	return (
		<TextField
			autoFocus={autoFocus}
			colors={{ focusedContainerColor: colors.cell, unfocusedContainerColor: colors.cell }}
			keyboardActions={{ onDone: submit, onSend: submit }}
			keyboardOptions={{
				autoCorrectEnabled: !plain,
				capitalization: plain ? "none" : "sentences",
				imeAction: onSubmit ? "send" : "done",
				keyboardType: keyboardFor(keyboard, secure),
			}}
			modifiers={[fillMaxWidth()]}
			onFocusChanged={(focused) => {
				if (!focused) onCommit?.(value.value)
			}}
			onValueChange={(next) => {
				onChangeText?.(next)
			}}
			singleLine
			textStyle={monospace ? { fontFamily: "monospace" } : undefined}
			value={value}
			visualTransformation={secure ? "password" : "none"}
		>
			{label ? (
				<TextField.Label>
					<Text>{label}</Text>
				</TextField.Label>
			) : null}
			{placeholder ? (
				<TextField.Placeholder>
					<Text>{placeholder}</Text>
				</TextField.Placeholder>
			) : null}
		</TextField>
	)
}

export function FormMenu({ groups, label }: FormMenuProps) {
	const { colors } = useMobileColors()
	const [expanded, setExpanded] = useState(false)
	return (
		<DropdownMenu
			color={colors.fill}
			expanded={expanded}
			onDismissRequest={() => setExpanded(false)}
		>
			<DropdownMenu.Trigger>
				<TextButton onClick={() => setExpanded(true)}>
					<Text color={colors.tint}>{label}</Text>
				</TextButton>
			</DropdownMenu.Trigger>
			<DropdownMenu.Items>
				{groups.map((group, groupIndex) => (
					<Fragment key={groupIndex}>
						{groupIndex > 0 ? <HorizontalDivider color={colors.separator} /> : null}
						{group.map((item) => {
							const itemColor = item.destructive ? colors.destructiveText : colors.label
							return (
								<DropdownMenuItem
									elementColors={{ textColor: itemColor }}
									enabled={!item.disabled}
									key={item.key}
									onClick={() => {
										setExpanded(false)
										item.onPress()
									}}
								>
									<DropdownMenuItem.Text>
										<Text color={itemColor} style={{ typography: "bodyMedium" }}>
											{item.label}
										</Text>
									</DropdownMenuItem.Text>
									{item.checked ? (
										<DropdownMenuItem.LeadingIcon>
											<RNHostView matchContents>
												<SymbolIcon
													color={colors.tint}
													name={{ sf: "checkmark", md: "check" }}
													size={20}
												/>
											</RNHostView>
										</DropdownMenuItem.LeadingIcon>
									) : null}
								</DropdownMenuItem>
							)
						})}
					</Fragment>
				))}
			</DropdownMenu.Items>
		</DropdownMenu>
	)
}

export function FormCheck({ checked }: FormCheckProps) {
	const { colors } = useMobileColors()
	if (!checked) return null
	return (
		<RNHostView matchContents>
			<SymbolIcon color={colors.tint} name={{ sf: "checkmark", md: "check" }} size={24} />
		</RNHostView>
	)
}
