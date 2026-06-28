import { dynamicIconImports, type IconName } from "lucide-react/dynamic"

type LucideIconName = IconName

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
	if (normalized in dynamicIconImports) return normalized as LucideIconName
	const kebabName = toKebabIconName(normalized)
	if (kebabName in dynamicIconImports) return kebabName as LucideIconName
	return undefined
}

function isValidLucideIconName(value: string): value is LucideIconName {
	return resolveLucideIconName(value) !== undefined
}

export { isValidLucideIconName, resolveLucideIconName }
export type { LucideIconName }
