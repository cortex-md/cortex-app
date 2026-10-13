import { Host } from "@expo/ui"
import { Button } from "@expo/ui/swift-ui"
import { buttonStyle, controlSize, foregroundStyle } from "@expo/ui/swift-ui/modifiers"
import { StyleSheet } from "react-native"

import type { NotePropertiesRowProps } from "@/features/note/noteChromeTypes"
import { notePropertiesLabel, PROPERTIES_ICON } from "@/features/note/notePropertiesLabel"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NotePropertiesRow({ count, onPress }: NotePropertiesRowProps) {
	const { colors, scheme } = useMobileColors()
	return (
		<Host colorScheme={scheme} matchContents style={styles.host}>
			<Button
				label={notePropertiesLabel(count)}
				modifiers={[
					buttonStyle("bordered"),
					controlSize("small"),
					foregroundStyle(colors.secondaryLabel),
				]}
				onPress={onPress}
				systemImage={PROPERTIES_ICON.sf}
			/>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		alignSelf: "flex-start",
		marginBottom: 4,
		marginHorizontal: 16,
		marginTop: 8,
	},
})
