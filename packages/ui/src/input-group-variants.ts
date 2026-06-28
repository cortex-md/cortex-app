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
				default: "rounded-[6px]",
				search: "gap-1.5 rounded-full",
			},
			size: {
				sm: "",
				default: "",
			},
		},
		compoundVariants: [
			{ variant: "default", size: "sm", className: "h-6" },
			{ variant: "default", size: "default", className: "h-8" },
			{ variant: "search", size: "sm", className: "h-8 px-2.5" },
			{ variant: "search", size: "default", className: "h-9 px-3" },
		],
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

const inputGroupAddonVariants = cva(
	"flex h-auto cursor-text items-center justify-center gap-1.5 py-1 text-[13px] font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 group-data-[variant=search]/input-group:px-0 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
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

const inputGroupButtonVariants = cva("flex items-center gap-2 text-sm shadow-none", {
	variants: {
		size: {
			xs: "h-6 gap-1 rounded-[6px] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
			sm: "h-8 gap-1.5 rounded-[6px] px-2.5 has-[>svg]:px-2.5",
			"icon-xs": "size-6 rounded-[6px] p-0 has-[>svg]:p-0",
			"icon-sm": "size-8 p-0 has-[>svg]:p-0",
		},
	},
	defaultVariants: {
		size: "xs",
	},
})

export { inputGroupAddonVariants, inputGroupButtonVariants, inputGroupVariants }
