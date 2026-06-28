import { DynamicIcon } from "lucide-react/dynamic"
import type { SVGAttributes } from "react"
import { type LucideIconName, resolveLucideIconName } from "./lucide-icon-utils"

interface Props extends SVGAttributes<SVGSVGElement> {
	name: LucideIconName | string
	size?: number | string
}

export function LucideIcon({ name, size = 16, ...rest }: Props) {
	const resolved = resolveLucideIconName(name)
	if (!resolved) return null
	return <DynamicIcon name={resolved} size={size} {...rest} />
}
