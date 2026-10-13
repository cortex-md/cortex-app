import {
	Box,
	DropdownMenu,
	DropdownMenuItem,
	Host,
	HorizontalDivider,
	RNHostView,
	Text,
} from "@expo/ui/jetpack-compose"
import { size } from "@expo/ui/jetpack-compose/modifiers"
import { Fragment, useState } from "react"
import { StyleSheet, View } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import {
	closeEntryMenu,
	type EntryMenuState,
	useEntryMenu,
} from "@/features/file-explorer/entryMenuStore"
import {
	type ActiveTextPrompt,
	closeTextPrompt,
	submitTextPrompt,
	useTextPrompt,
} from "@/features/file-explorer/textPromptStore"
import { useMobileColors } from "@/hooks/useMobileColors"

function EntryMenu({ menu }: { menu: EntryMenuState }) {
	const { colors, scheme } = useMobileColors()
	return (
		<Host
			colorScheme={scheme}
			matchContents
			seedColor={colors.tintFill}
			style={[styles.anchor, { left: menu.x, top: menu.y }]}
		>
			<DropdownMenu color={colors.menuBackground} expanded onDismissRequest={closeEntryMenu}>
				<DropdownMenu.Trigger>
					<Box modifiers={[size(1, 1)]} />
				</DropdownMenu.Trigger>
				<DropdownMenu.Items>
					{menu.header ? (
						<DropdownMenuItem enabled={false}>
							<DropdownMenuItem.Text>
								<Text color={colors.secondaryLabel} style={{ typography: "labelMedium" }}>
									{menu.header}
								</Text>
							</DropdownMenuItem.Text>
						</DropdownMenuItem>
					) : null}
					{menu.groups.map((group, groupIndex) => (
						<Fragment key={group[0]?.key ?? groupIndex}>
							{groupIndex > 0 ? <HorizontalDivider color={colors.separator} /> : null}
							{group.map((item) => {
								const itemColor = item.destructive ? colors.destructiveText : colors.label
								return (
									<DropdownMenuItem
										elementColors={{ leadingIconColor: itemColor, textColor: itemColor }}
										enabled={!item.disabled}
										key={item.key}
										onClick={() => {
											closeEntryMenu()
											item.onPress()
										}}
									>
										<DropdownMenuItem.Text>
											<Text color={itemColor} style={{ typography: "bodyLarge" }}>
												{item.label}
											</Text>
										</DropdownMenuItem.Text>
										{item.icon ? (
											<DropdownMenuItem.LeadingIcon>
												<RNHostView matchContents>
													<View>
														<Symbol
															color={
																item.destructive ? colors.destructiveText : colors.secondaryLabel
															}
															name={item.icon}
															size={24}
														/>
													</View>
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
		</Host>
	)
}

function PromptDialog({ prompt }: { prompt: ActiveTextPrompt }) {
	const [error, setError] = useState<string | null>(null)

	return (
		<TextPromptDialog
			confirmLabel={prompt.confirmLabel}
			error={error}
			initialValue={prompt.initialValue}
			message={prompt.message}
			onCancel={() => closeTextPrompt(prompt.id)}
			onChangeText={(value) =>
				setError(value.trim() ? (prompt.validate?.(value.trim()) ?? null) : null)
			}
			onConfirm={(value) => {
				void submitTextPrompt(prompt, value).then((submitError) => {
					if (submitError) setError(submitError)
					else closeTextPrompt(prompt.id)
				})
			}}
			placeholder={prompt.placeholder}
			title={prompt.title}
			visible
		/>
	)
}

export function FileExplorerHost() {
	const menu = useEntryMenu()
	const prompt = useTextPrompt()
	return (
		<>
			{menu ? <EntryMenu key={menu.id} menu={menu} /> : null}
			{prompt ? <PromptDialog key={prompt.id} prompt={prompt} /> : null}
		</>
	)
}

const styles = StyleSheet.create({
	anchor: {
		position: "absolute",
	},
})
