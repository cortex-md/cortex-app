import {
	AlertDialog,
	Column,
	Host,
	RadioButton,
	Row,
	Text,
	TextButton,
} from "@expo/ui/jetpack-compose"
import { clickable, fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers"

import type { StatusPickerProps } from "@/features/database/statusPickerTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function StatusPicker({
	message,
	onPresentedChange,
	onSelect,
	options,
	presented,
	title,
	value,
}: StatusPickerProps) {
	const { colors, scheme } = useMobileColors()
	if (!presented) return null

	function choose(id: string) {
		onPresentedChange(false)
		onSelect(id)
	}

	return (
		<Host colorScheme={scheme} matchContents seedColor={colors.tintFill}>
			<AlertDialog
				colors={{
					containerColor: colors.elevated,
					textContentColor: colors.secondaryLabel,
					titleContentColor: colors.label,
				}}
				onDismissRequest={() => onPresentedChange(false)}
			>
				<AlertDialog.Title>
					<Text>{title}</Text>
				</AlertDialog.Title>
				<AlertDialog.Text>
					<Column>
						<Text color={String(colors.secondaryLabel)}>{message}</Text>
						{options.map((option) => (
							<Row
								key={option.id}
								modifiers={[
									fillMaxWidth(),
									clickable(() => choose(option.id)),
									padding(0, 4, 0, 4),
								]}
								verticalAlignment="center"
							>
								<RadioButton onClick={() => choose(option.id)} selected={option.id === value} />
								<Text color={String(colors.label)}>{option.label}</Text>
							</Row>
						))}
					</Column>
				</AlertDialog.Text>
				<AlertDialog.DismissButton>
					<TextButton onClick={() => onPresentedChange(false)}>
						<Text>Cancel</Text>
					</TextButton>
				</AlertDialog.DismissButton>
			</AlertDialog>
		</Host>
	)
}
