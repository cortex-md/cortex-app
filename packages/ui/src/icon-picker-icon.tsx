import type { LucideIcon, LucideProps } from "lucide-react"
import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import * as React from "react"

interface IconProps extends Omit<LucideProps, "ref"> {
	ref?: React.Ref<React.ComponentRef<LucideIcon>>
	name: IconName
}

function Icon({ name, ref, ...props }: IconProps) {
	return <DynamicIcon name={name} {...props} ref={ref} />
}

const IconRenderer = React.memo(({ name }: { name: IconName }) => {
	return <Icon name={name} />
})
IconRenderer.displayName = "IconRenderer"

export { Icon, IconRenderer, type IconName }
