import type { ContributionIcon } from "@cortex/plugin-host-core"
import type { LucideIcon, LucideProps } from "lucide-react-native"
import * as lucideIcons from "lucide-react-native/icons"
import { createElement } from "react"
import { type ColorValue, StyleSheet, Text } from "react-native"

import { SymbolIcon } from "@/components/ui/Symbol"

const iconsByName: Record<string, LucideIcon | undefined> = lucideIcons
const ICON_NAME_PATTERN = /^[\w\s-]+$/
const MAX_EMOJI_LENGTH = 16

function toIconComponentName(name: string): string {
	return name
		.trim()
		.split(/[-_\s]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")
}

export function resolvePluginIcon(name: ContributionIcon | undefined): LucideIcon | undefined {
	return typeof name === "string" ? iconsByName[toIconComponentName(name)] : undefined
}

function resolveEmojiIcon(name: ContributionIcon | undefined): string | undefined {
	if (typeof name !== "string") return undefined
	const text = name.trim()
	if (!text || text.length > MAX_EMOJI_LENGTH || ICON_NAME_PATTERN.test(text)) return undefined
	return text
}

export function PluginIcon({
	name,
	...props
}: LucideProps & { name: ContributionIcon | undefined }) {
	const icon = resolvePluginIcon(name)
	return icon ? createElement(icon, props) : null
}

export function PluginContributionIcon({
	color,
	name,
	size,
}: {
	color: ColorValue
	name: ContributionIcon | undefined
	size: number
}) {
	const icon = resolvePluginIcon(name)
	if (icon) return createElement(icon, { color: color as string, size, strokeWidth: 2 })
	const emoji = resolveEmojiIcon(name)
	if (emoji) {
		return (
			<Text
				allowFontScaling={false}
				numberOfLines={1}
				style={[styles.emoji, { fontSize: size * 0.9, lineHeight: size + 2, width: size }]}
			>
				{emoji}
			</Text>
		)
	}
	return (
		<SymbolIcon color={color} name={{ sf: "puzzlepiece.extension", md: "extension" }} size={size} />
	)
}

const styles = StyleSheet.create({
	emoji: {
		textAlign: "center",
	},
})
