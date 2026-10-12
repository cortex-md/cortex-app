import type { ContributionIcon } from "@cortex/plugin-host-core"
import type { LucideIcon, LucideProps } from "lucide-react-native"
import * as lucideIcons from "lucide-react-native/icons"
import { createElement } from "react"

const iconsByName: Record<string, LucideIcon | undefined> = lucideIcons

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

export function PluginIcon({
	name,
	...props
}: LucideProps & { name: ContributionIcon | undefined }) {
	const icon = resolvePluginIcon(name)
	return icon ? createElement(icon, props) : null
}
