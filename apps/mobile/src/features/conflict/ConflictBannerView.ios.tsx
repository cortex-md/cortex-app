import { Button, Host, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui"
import {
	buttonStyle,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	glassEffect,
	padding,
} from "@expo/ui/swift-ui/modifiers"
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
	const { colors, scheme } = useMobileColors()
	return (
		<Host colorScheme={scheme} matchContents={{ vertical: true }} style={styles.host}>
			<VStack
				alignment="leading"
				modifiers={[
					frame({ alignment: "leading", maxWidth: Number.MAX_SAFE_INTEGER }),
					padding({ all: 14 }),
					glassEffect({
						cornerRadius: 18,
						glass: { tint: colors.warningBackground, variant: "regular" },
						shape: "roundedRectangle",
					}),
				]}
				spacing={10}
			>
				<HStack spacing={8}>
					<Image
						modifiers={[foregroundStyle(colors.warningText)]}
						systemName="exclamationmark.triangle.fill"
					/>
					<Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(colors.label)]}>
						{CONFLICT_BANNER_TITLE}
					</Text>
				</HStack>
				<Text modifiers={[font({ size: 14 }), foregroundStyle(colors.secondaryLabel)]}>
					{CONFLICT_BANNER_MESSAGE}
				</Text>
				<HStack spacing={8}>
					<Button
						label="Keep mine"
						modifiers={[buttonStyle("glass"), controlSize("small"), disabled(busy)]}
						onPress={onKeepMine}
					/>
					<Button
						label="Keep theirs"
						modifiers={[buttonStyle("glass"), controlSize("small"), disabled(busy)]}
						onPress={onKeepTheirs}
					/>
					<Spacer />
					<Button
						label="Compare"
						modifiers={[buttonStyle("borderless"), controlSize("small"), disabled(busy)]}
						onPress={onCompare}
					/>
				</HStack>
			</VStack>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		marginHorizontal: 16,
		marginVertical: 6,
	},
})
