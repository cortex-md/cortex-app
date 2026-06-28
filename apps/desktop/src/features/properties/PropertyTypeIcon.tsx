import { LucideIcon } from "@cortex/ui"

interface PropertyTypeIconProps {
	icon: string
	className?: string
}

function normalizeIconName(icon: string): string {
	return icon
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1)}`)
		.join("")
}

export function PropertyTypeIcon({ icon, className }: PropertyTypeIconProps) {
	return <LucideIcon name={normalizeIconName(icon)} className={className} aria-hidden="true" />
}
