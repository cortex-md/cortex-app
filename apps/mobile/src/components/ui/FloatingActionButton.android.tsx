import { Host } from "@expo/ui"
import { ExtendedFloatingActionButton, RNHostView, Text } from "@expo/ui/jetpack-compose"
import { View } from "react-native"

import type { FloatingActionButtonProps } from "@/components/ui/fabTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function FloatingActionButton({ Icon, label, onPress }: FloatingActionButtonProps) {
	const { colors } = useMobileColors()

	return (
		<Host matchContents>
			<ExtendedFloatingActionButton containerColor={colors.tintFill} onClick={onPress}>
				<ExtendedFloatingActionButton.Icon>
					<RNHostView matchContents>
						<View>
							<Icon color={colors.onTint} size={24} strokeWidth={2} />
						</View>
					</RNHostView>
				</ExtendedFloatingActionButton.Icon>
				<ExtendedFloatingActionButton.Text>
					<Text color={colors.onTint} style={{ typography: "labelLarge" }}>
						{label}
					</Text>
				</ExtendedFloatingActionButton.Text>
			</ExtendedFloatingActionButton>
		</Host>
	)
}
