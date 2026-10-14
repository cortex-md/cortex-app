import { cva } from "class-variance-authority"
import { nativeTextFieldSurface } from "./lib/native-styles"

const inputGroupVariants = cva(
	[
		"group/input-group relative flex w-full min-w-0 items-center outline-none transition-[background-color,border-color,color,box-shadow]",
		nativeTextFieldSurface,
	],
	{
		variants: {
			variant: {
				default: "rounded-[var(--control-radius,6px)]",
				search: "gap-2 rounded-full",
			},
			size: {
				sm: "",
				default: "",
			},
		},
		compoundVariants: [
			{ variant: "default", size: "sm", className: "h-[var(--control-height-sm,28px)]" },
			{ variant: "default", size: "default", className: "h-[var(--input-height-md,36px)]" },
			{ variant: "search", size: "sm", className: "h-9 px-3" },
			{ variant: "search", size: "default", className: "h-10 px-3.5" },
		],
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

const inputGroupAddonVariants = cva(
	"flex h-auto cursor-text items-center justify-center gap-1.5 py-1 text-[14px] font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 group-data-[variant=search]/input-group:px-0 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 group-data-[variant=search]/input-group:[&>svg:not([class*='size-'])]:size-[17px]",
	{
		variants: {
			align: {
				"inline-start":
					"order-first pl-3 group-data-[variant=search]/input-group:pl-0 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
				"inline-end":
					"order-last pr-3 group-data-[variant=search]/input-group:pr-0 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
				"block-start":
					"order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
				"block-end":
					"order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
)

const inputGroupButtonVariants = cva("shadow-none", {
	variants: {
		size: {
			xs: "",
			sm: "",
			"icon-xs": "",
			"icon-sm": "",
		},
	},
	defaultVariants: {
		size: "xs",
	},
})

export { inputGroupAddonVariants, inputGroupButtonVariants, inputGroupVariants }
