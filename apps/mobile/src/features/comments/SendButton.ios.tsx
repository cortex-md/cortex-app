import { Button, Host, Image } from "@expo/ui/swift-ui"
import {
	buttonBorderShape,
	buttonStyle,
	controlSize,
	disabled as disabledModifier,
	font,
} from "@expo/ui/swift-ui/modifiers"

import type { SendButtonProps } from "@/features/comments/sendButtonTypes"

export function SendButton({ disabled, onPress }: SendButtonProps) {
	return (
		<Host matchContents>
			<Button
				modifiers={[
					buttonStyle("glassProminent"),
					buttonBorderShape("circle"),
					controlSize("regular"),
					disabledModifier(disabled),
				]}
				onPress={onPress}
			>
				<Image modifiers={[font({ size: 17, weight: "semibold" })]} systemName="arrow.up" />
			</Button>
		</Host>
	)
}
