import { LUCIDE_ICON_NAMES } from "./lucide-icon-names"

type LucideIconName = string & { readonly __lucideIconName?: true }

const iconNames = new Set(LUCIDE_ICON_NAMES.split("|"))

function toKebabIconName(name: string): string {
	return name
		.trim()
		.replace(/Icon$/, "")
		.replace(/_/g, "-")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase()
}

function resolveLucideIconName(name: string): LucideIconName | undefined {
	const normalized = name.trim()
	if (iconNames.has(normalized)) return normalized as LucideIconName
	const kebabName = toKebabIconName(normalized)
	if (iconNames.has(kebabName)) return kebabName as LucideIconName
	return undefined
}

function isValidLucideIconName(value: string): value is LucideIconName {
	return resolveLucideIconName(value) !== undefined
}

export type { LucideIconName }
export { isValidLucideIconName, resolveLucideIconName }
