import { Host } from "@expo/ui"
import { AssistChip, RNHostView, Text } from "@expo/ui/jetpack-compose"
import { StyleSheet } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
import type { NotePropertiesRowProps } from "@/features/note/noteChromeTypes"
import { notePropertiesLabel, PROPERTIES_ICON } from "@/features/note/notePropertiesLabel"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NotePropertiesRow({ count, onPress }: NotePropertiesRowProps) {
	const { colors, scheme } = useMobileColors()
	return (
		<Host colorScheme={scheme} matchContents seedColor={colors.tintFill} style={styles.host}>
			<AssistChip onClick={onPress}>
				<AssistChip.Label>
					<Text>{notePropertiesLabel(count)}</Text>
				</AssistChip.Label>
				<AssistChip.LeadingIcon>
					<RNHostView matchContents>
						<Symbol color={colors.secondaryLabel} name={PROPERTIES_ICON} size={18} />
					</RNHostView>
				</AssistChip.LeadingIcon>
			</AssistChip>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		alignSelf: "flex-start",
		marginHorizontal: 16,
		marginTop: 4,
	},
})
