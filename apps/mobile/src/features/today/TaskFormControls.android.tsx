import { formatRelativeDay } from "@cortex/tasks"
import { DateTimePicker, DropdownMenu, DropdownMenuItem, Text } from "@expo/ui/jetpack-compose"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { FormRow, FormToggle, NativeForm } from "@/components/ui/Form"
import { MobileTextField } from "@/components/ui/MobileTextField"
import type { ChoiceRowProps, DateRowProps, TaskFormProps } from "@/features/today/taskFormTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function TaskForm({
	autoFocus = false,
	children,
	initialTitle,
	onSubmitTitle,
	onTitleChange,
	placeholder,
}: TaskFormProps) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<View style={styles.field}>
				<MobileTextField
					accessibilityLabel={placeholder}
					autoFocus={autoFocus}
					defaultValue={initialTitle}
					onChangeText={onTitleChange}
					onSubmitText={() => onSubmitTitle?.()}
					placeholder={placeholder}
					returnKeyType="done"
				/>
			</View>
			<NativeForm>{children}</NativeForm>
		</View>
	)
}

export function ChoiceRow<T extends string>({
	disabled = false,
	icon,
	onChange,
	options,
	title,
	value,
}: ChoiceRowProps<T>) {
	const { colors } = useMobileColors()
	const [expanded, setExpanded] = useState(false)
	const selected = options.find((option) => option.value === value)
	return (
		<DropdownMenu
			color={colors.fill}
			expanded={expanded}
			onDismissRequest={() => setExpanded(false)}
		>
			<DropdownMenu.Trigger>
				<FormRow
					disabled={disabled}
					icon={icon}
					onPress={() => setExpanded(true)}
					title={title}
					value={selected?.label}
				/>
			</DropdownMenu.Trigger>
			<DropdownMenu.Items>
				{options.map((option) => {
					const color = option.value === value ? colors.tint : colors.label
					return (
						<DropdownMenuItem
							elementColors={{ textColor: color }}
							key={option.value}
							onClick={() => {
								setExpanded(false)
								onChange(option.value)
							}}
						>
							<DropdownMenuItem.Text>
								<Text color={color} style={{ typography: "bodyMedium" }}>
									{option.label}
								</Text>
							</DropdownMenuItem.Text>
						</DropdownMenuItem>
					)
				})}
			</DropdownMenu.Items>
		</DropdownMenu>
	)
}

export function DateRow({ icon, onChange, title, today, value }: DateRowProps) {
	const { colors } = useMobileColors()
	const [picking, setPicking] = useState(false)
	return (
		<>
			<FormToggle
				icon={icon}
				onValueChange={(on) => {
					setPicking(on)
					onChange(on ? (value ?? today) : undefined)
				}}
				subtitle={value ? formatRelativeDay(value, today) : undefined}
				title={title}
				value={value !== undefined}
			/>
			{value && !picking ? (
				<FormRow chevron onPress={() => setPicking(true)} title="Change date" />
			) : null}
			{value && picking ? (
				<DateTimePicker
					color={colors.tintFill}
					displayedComponents="date"
					initialDate={value}
					onDateSelected={(date) => {
						setPicking(false)
						onChange(date.toISOString().slice(0, 10))
					}}
					showVariantToggle={false}
					variant="picker"
				/>
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	field: {
		paddingBottom: 4,
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	root: {
		flex: 1,
	},
})
