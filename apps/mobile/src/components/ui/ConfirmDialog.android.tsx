import {
	AlertDialog,
	Column,
	Host,
	OutlinedTextField,
	Row,
	Text,
	TextButton,
} from "@expo/ui/jetpack-compose"
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers"
import { useState } from "react"

import type { ConfirmDialogProps } from "@/components/ui/dialogTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function ConfirmAlert({
	cancelLabel = "Cancel",
	confirmLabel,
	destructive = false,
	impact,
	message,
	onCancel,
	onConfirm,
	title,
	typedName,
}: ConfirmDialogProps) {
	const { colors, scheme } = useMobileColors()
	const [typed, setTyped] = useState("")
	const confirmEnabled = !typedName || typed.trim() === typedName

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
				{message || impact || typedName ? (
					<AlertDialog.Text>
						<Column verticalArrangement={{ spacedBy: 16 }}>
							{message ? <Text style={{ typography: "bodyMedium" }}>{message}</Text> : null}
							{impact ? (
								<Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
									{impact.map((cell) => (
										<Column key={cell.label} modifiers={[weight(1)]}>
											<Text color={colors.secondaryLabel} style={{ typography: "labelSmall" }}>
												{cell.label}
											</Text>
											<Text color={colors.label} style={{ typography: "bodyMedium" }}>
												{cell.value}
											</Text>
										</Column>
									))}
								</Row>
							) : null}
							{typedName ? (
								<OutlinedTextField
									autoFocus
									keyboardOptions={{ autoCorrectEnabled: false, capitalization: "none" }}
									modifiers={[fillMaxWidth()]}
									onValueChange={setTyped}
									singleLine
								>
									<OutlinedTextField.Placeholder>
										<Text>{`Type ${typedName} to confirm`}</Text>
									</OutlinedTextField.Placeholder>
								</OutlinedTextField>
							) : null}
						</Column>
					</AlertDialog.Text>
				) : null}
				<AlertDialog.ConfirmButton>
					<TextButton enabled={confirmEnabled} onClick={onConfirm}>
						<Text color={destructive ? colors.destructiveText : colors.tint}>{confirmLabel}</Text>
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

export function ConfirmDialog(props: ConfirmDialogProps) {
	if (!props.visible) return null
	return <ConfirmAlert {...props} />
}
