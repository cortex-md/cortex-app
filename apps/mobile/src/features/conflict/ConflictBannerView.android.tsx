import { Card, Column, Host, Row, Text, TextButton } from "@expo/ui/jetpack-compose"
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers"
import { StyleSheet } from "react-native"

import {
	CONFLICT_BANNER_MESSAGE,
	CONFLICT_BANNER_TITLE,
	type ConflictBannerViewProps,
} from "@/features/conflict/conflictBannerTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function ConflictBannerView({
	busy,
	onCompare,
	onKeepMine,
	onKeepTheirs,
}: ConflictBannerViewProps) {
	const { colors } = useMobileColors()
	const buttonColors = { contentColor: colors.warningText }
	return (
		<Host matchContents={{ vertical: true }} style={styles.host}>
			<Card
				colors={{ containerColor: colors.warningBackground, contentColor: colors.label }}
				modifiers={[fillMaxWidth()]}
			>
				<Column modifiers={[padding(16, 12, 8, 4)]}>
					<Text color={String(colors.label)} style={{ typography: "titleSmall" }}>
						{CONFLICT_BANNER_TITLE}
					</Text>
					<Text color={String(colors.secondaryLabel)} style={{ typography: "bodyMedium" }}>
						{CONFLICT_BANNER_MESSAGE}
					</Text>
					<Row>
						<TextButton colors={buttonColors} enabled={!busy} onClick={onKeepMine}>
							<Text>Keep mine</Text>
						</TextButton>
						<TextButton colors={buttonColors} enabled={!busy} onClick={onKeepTheirs}>
							<Text>Keep theirs</Text>
						</TextButton>
						<TextButton colors={buttonColors} enabled={!busy} onClick={onCompare}>
							<Text>Compare</Text>
						</TextButton>
					</Row>
				</Column>
			</Card>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		marginHorizontal: 16,
		marginVertical: 6,
	},
})
