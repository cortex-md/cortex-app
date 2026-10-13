import { Host } from "@expo/ui"
import { ExtendedFloatingActionButton, RNHostView, Text } from "@expo/ui/jetpack-compose"
import type { FloatingActionButtonProps } from "@/components/ui/fabTypes"
import { SymbolIcon } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

export function FloatingActionButton({ icon, label, onPress }: FloatingActionButtonProps) {
	const { colors } = useMobileColors()

	return (
		<Host matchContents>
			<ExtendedFloatingActionButton containerColor={colors.tintFill} onClick={onPress}>
				<ExtendedFloatingActionButton.Icon>
					<RNHostView matchContents>
						<SymbolIcon color={colors.onTint} name={icon} size={24} />
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
