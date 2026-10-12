import { BottomSheet, Column, Button as ExpoButton, FieldGroup, Host, ListItem } from "@expo/ui"
import type { ReactNode } from "react"
import { StyleSheet } from "react-native"

export function ActionSheet({
	children,
	isPresented,
	onDismiss,
	sectionTitle,
	spacing = 10,
	supportingText,
	title,
}: {
	children: ReactNode
	isPresented: boolean
	onDismiss: () => void
	sectionTitle: string
	spacing?: number
	supportingText: string
	title: string
}) {
	return (
		<Host>
			<BottomSheet isPresented={isPresented} onDismiss={onDismiss} showDragIndicator>
				<Column spacing={spacing} style={styles.content}>
					<FieldGroup>
						<FieldGroup.Section title={sectionTitle}>
							<ListItem supportingText={supportingText}>{title}</ListItem>
						</FieldGroup.Section>
					</FieldGroup>
					{children}
					<ExpoButton label="Cancel" onPress={onDismiss} variant="text" />
				</Column>
			</BottomSheet>
		</Host>
	)
}

const styles = StyleSheet.create({
	content: {
		padding: 16,
	},
})
