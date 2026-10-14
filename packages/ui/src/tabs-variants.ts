import { cva } from "class-variance-authority"
import { nativeQuietFill } from "./lib/native-styles"

const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-full text-muted-foreground group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
	{
		variants: {
			variant: {
				default: [
					"gap-0.5 border-0 p-[3px] shadow-none group-data-[orientation=horizontal]/tabs:h-[var(--button-height-md,36px)]",
					nativeQuietFill,
				],
				line: "gap-1 bg-transparent p-1 group-data-[orientation=horizontal]/tabs:h-9",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

export { tabsListVariants }
