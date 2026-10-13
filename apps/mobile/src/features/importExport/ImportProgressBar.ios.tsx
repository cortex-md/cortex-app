import { Host } from "@expo/ui"
import { ProgressView } from "@expo/ui/swift-ui"
import { progressViewStyle, tint } from "@expo/ui/swift-ui/modifiers"

import { useMobileColors } from "@/hooks/useMobileColors"

export function ImportProgressBar({ value }: { value: number }) {
	const { colors } = useMobileColors()
	return (
		<Host matchContents>
			<ProgressView modifiers={[progressViewStyle("linear"), tint(colors.tintFill)]} value={value} />
		</Host>
	)
}
