import { cva } from "class-variance-authority"
import { nativeControlSurface } from "./lib/native-styles"

const navigationMenuTriggerStyle = cva([
	"group inline-flex h-7 w-max items-center justify-center rounded-[6px] px-3 py-1.5 text-[13px] font-medium outline-none transition-[background-color,border-color,color,box-shadow] hover:bg-accent/70 hover:text-accent-foreground focus:bg-accent/70 focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/70 data-[state=open]:text-accent-foreground data-[state=open]:hover:bg-accent/70 data-[state=open]:focus:bg-accent/70",
	nativeControlSurface,
])

export { navigationMenuTriggerStyle }
