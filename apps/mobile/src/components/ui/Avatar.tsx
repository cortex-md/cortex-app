import { StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export type AvatarTint = "accent" | "blue" | "green" | "violet"

export function getInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("")
}

export function Avatar({
	live = false,
	name,
	size = 26,
	tint = "accent",
}: {
	live?: boolean
	name: string
	size?: 18 | 22 | 24 | 26 | 36 | 72
	tint?: AvatarTint
}) {
	const { colors } = useMobileColors()
	const palette = {
		accent: { background: colors.accentSubtle, text: colors.tint },
		blue: { background: colors.accentSubtle, text: colors.headingBlue },
		green: { background: colors.successBackground, text: colors.successText },
		violet: { background: colors.accentSubtle, text: colors.headingViolet },
	}[tint]
	const fontSize = size >= 72 ? 28 : size >= 36 ? 13 : size >= 24 ? 11 : 8

	return (
		<View style={{ height: size, width: size }}>
			<View
				accessibilityLabel={name}
				style={[
					styles.circle,
					{ backgroundColor: palette.background, borderRadius: size / 2, height: size, width: size },
				]}
			>
				<Text style={[styles.initials, { color: palette.text, fontSize }]}>{getInitials(name)}</Text>
			</View>
			{live ? (
				<View
					style={[
						styles.live,
						{ backgroundColor: colors.success, borderColor: colors.background },
					]}
				/>
			) : null}
		</View>
	)
}

export function AvatarStack({ names }: { names: string[] }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.stack}>
			{names.map((name, index) => (
				<View
					key={name}
					style={[
						styles.stackItem,
						{ borderColor: colors.background, marginLeft: index === 0 ? 0 : -7 },
					]}
				>
					<Avatar name={name} size={26} />
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	circle: {
		alignItems: "center",
		justifyContent: "center",
	},
	initials: {
		fontWeight: "600",
	},
	live: {
		borderRadius: 999,
		borderWidth: 2,
		bottom: -1,
		height: 11,
		position: "absolute",
		right: -1,
		width: 11,
	},
	stack: {
		flexDirection: "row",
	},
	stackItem: {
		borderRadius: 999,
		borderWidth: 2,
	},
})
