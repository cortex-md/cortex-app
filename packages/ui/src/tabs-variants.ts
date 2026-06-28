import { cva } from "class-variance-authority"
import { nativeGlassSurface } from "./lib/native-styles"

const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
	{
		variants: {
			variant: {
				default: nativeGlassSurface,
				line: "gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

export { tabsListVariants }
