import {
	AlertDialog,
	Column,
	Host,
	OutlinedTextField,
	Text,
	TextButton,
	useNativeState,
} from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { useState } from "react"

import type { TextPromptDialogProps } from "@/components/ui/dialogTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function PromptAlert({
	cancelLabel = "Cancel",
	confirmLabel,
	error,
	initialValue = "",
	message,
	onCancel,
	onChangeText,
	onConfirm,
	placeholder,
	title,
}: TextPromptDialogProps) {
	const { colors, scheme } = useMobileColors()
	const text = useNativeState(initialValue)
	const [value, setValue] = useState(initialValue)
	const confirmEnabled = value.trim().length > 0 && !error

	function submit() {
		if (confirmEnabled) onConfirm(value.trim())
	}

	return (
		<Host colorScheme={scheme} matchContents seedColor={colors.tintFill}>
			<AlertDialog
				colors={{
					containerColor: colors.elevated,
					textContentColor: colors.secondaryLabel,
					titleContentColor: colors.label,
				}}
				onDismissRequest={onCancel}
			>
				<AlertDialog.Title>
					<Text>{title}</Text>
				</AlertDialog.Title>
				<AlertDialog.Text>
					<Column verticalArrangement={{ spacedBy: 16 }}>
						{message ? <Text style={{ typography: "bodyMedium" }}>{message}</Text> : null}
						<OutlinedTextField
							autoFocus
							isError={Boolean(error)}
							keyboardActions={{ onDone: submit }}
							keyboardOptions={{ imeAction: "done" }}
							modifiers={[fillMaxWidth()]}
							onValueChange={(next) => {
								setValue(next)
								onChangeText?.(next)
							}}
							singleLine
							value={text}
						>
							{placeholder ? (
								<OutlinedTextField.Placeholder>
									<Text>{placeholder}</Text>
								</OutlinedTextField.Placeholder>
							) : null}
							{error ? (
								<OutlinedTextField.SupportingText>
									<Text color={colors.destructiveText}>{error}</Text>
								</OutlinedTextField.SupportingText>
							) : null}
						</OutlinedTextField>
					</Column>
				</AlertDialog.Text>
				<AlertDialog.ConfirmButton>
					<TextButton enabled={confirmEnabled} onClick={submit}>
						<Text color={colors.tint}>{confirmLabel}</Text>
					</TextButton>
				</AlertDialog.ConfirmButton>
				<AlertDialog.DismissButton>
					<TextButton onClick={onCancel}>
						<Text color={colors.tint}>{cancelLabel}</Text>
					</TextButton>
				</AlertDialog.DismissButton>
			</AlertDialog>
		</Host>
	)
}

export function TextPromptDialog(props: TextPromptDialogProps) {
	if (!props.visible) return null
	return <PromptAlert {...props} />
}
