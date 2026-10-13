import { Host } from "@expo/ui"
import { Button, ConfirmationDialog, Image, Text } from "@expo/ui/swift-ui"
import { foregroundStyle, frame } from "@expo/ui/swift-ui/modifiers"

import type { VaultActionsMenuProps } from "@/features/vault/vaultActionsTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function VaultActionsMenu({
	accessibilityLabel,
	groups,
	message,
	onPresentedChange,
	presented,
	title,
}: VaultActionsMenuProps) {
	const { colors } = useMobileColors()
	return (
		<Host matchContents>
			<ConfirmationDialog
				isPresented={presented}
				onIsPresentedChange={onPresentedChange}
				title={title}
				titleVisibility="visible"
			>
				<ConfirmationDialog.Trigger>
					<Button onPress={() => onPresentedChange(true)} testID={accessibilityLabel}>
						<Image
							modifiers={[frame({ height: 32, width: 32 }), foregroundStyle(colors.secondaryLabel)]}
							systemName="ellipsis.circle"
						/>
					</Button>
				</ConfirmationDialog.Trigger>
				<ConfirmationDialog.Message>
					<Text>{message}</Text>
				</ConfirmationDialog.Message>
				<ConfirmationDialog.Actions>
					{groups.flat().map((item) => (
						<Button
							key={item.key}
							label={item.label}
							onPress={() => {
								onPresentedChange(false)
								item.onPress()
							}}
							role={item.destructive ? "destructive" : "default"}
						/>
					))}
					<Button label="Cancel" onPress={() => onPresentedChange(false)} role="cancel" />
				</ConfirmationDialog.Actions>
			</ConfirmationDialog>
		</Host>
	)
}
