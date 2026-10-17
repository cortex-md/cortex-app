import { Host } from "@expo/ui"
import { Button } from "@expo/ui/swift-ui"
import { buttonStyle, controlSize, tint } from "@expo/ui/swift-ui/modifiers"

import type { FloatingActionButtonProps } from "@/components/ui/fabTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function FloatingActionButton({ icon, label, onPress }: FloatingActionButtonProps) {
	const { colors } = useMobileColors()

	return (
		<Host matchContents>
			<Button
				label={label}
				modifiers={[buttonStyle("glassProminent"), controlSize("large"), tint(colors.tintFill)]}
				onPress={onPress}
				systemImage={icon.sf}
			/>
		</Host>
	)
}
