import { Host } from "@expo/ui"
import { Button, ConfirmationDialog, Text } from "@expo/ui/swift-ui"
import { StyleSheet } from "react-native"

import type { StatusPickerProps } from "@/features/database/statusPickerTypes"

export function StatusPicker({
	message,
	onPresentedChange,
	onSelect,
	options,
	presented,
	title,
}: StatusPickerProps) {
	return (
		<Host style={styles.host}>
			<ConfirmationDialog
				isPresented={presented}
				onIsPresentedChange={onPresentedChange}
				title={title}
				titleVisibility="visible"
			>
				<ConfirmationDialog.Trigger>
					<Text> </Text>
				</ConfirmationDialog.Trigger>
				<ConfirmationDialog.Message>
					<Text>{message}</Text>
				</ConfirmationDialog.Message>
				<ConfirmationDialog.Actions>
					{options.map((option) => (
						<Button
							key={option.id}
							label={option.label}
							onPress={() => {
								onPresentedChange(false)
								onSelect(option.id)
							}}
						/>
					))}
					<Button label="Cancel" onPress={() => onPresentedChange(false)} role="cancel" />
				</ConfirmationDialog.Actions>
			</ConfirmationDialog>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		height: 1,
		position: "absolute",
		width: 1,
	},
})
