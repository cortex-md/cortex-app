import { Host } from "@expo/ui"
import { LinearProgressIndicator } from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"

import { useMobileColors } from "@/hooks/useMobileColors"

export function ImportProgressBar({ value }: { value: number }) {
	const { colors } = useMobileColors()
	return (
		<Host matchContents>
			<LinearProgressIndicator
				color={colors.tintFill}
				modifiers={[fillMaxWidth()]}
				progress={value}
				trackColor={colors.fill}
			/>
		</Host>
	)
}
