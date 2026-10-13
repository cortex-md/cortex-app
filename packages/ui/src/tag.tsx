import type { VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"
import type * as React from "react"

import { cn } from "./lib/utils"
import { tagRemoveButtonClassName, tagVariants } from "./tag-variants"

type TagProps = React.ComponentProps<"span"> &
	VariantProps<typeof tagVariants> & {
		onRemove?: () => void
		removeLabel?: string
	}

function Tag({
	className,
	variant = "default",
	interactive = false,
	onRemove,
	removeLabel,
	children,
	...props
}: TagProps) {
	return (
		<span
			data-slot="tag"
			data-variant={variant}
			className={cn(tagVariants({ variant, interactive }), className)}
			{...props}
		>
			<span className="truncate">{children}</span>
			{onRemove ? (
				<button
					type="button"
					data-slot="tag-remove"
					className={tagRemoveButtonClassName}
					aria-label={removeLabel ?? "Remove"}
					onClick={(event) => {
						event.stopPropagation()
						onRemove()
					}}
				>
					<XIcon aria-hidden="true" />
				</button>
			) : null}
		</span>
	)
}

export { Tag }
