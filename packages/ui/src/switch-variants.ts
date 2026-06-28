import { cva } from "class-variance-authority"

const switchVariants = cva(
	"peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-black/5 shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)] outline-none transition-[background-color,border-color,box-shadow,opacity,filter] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-white/15 data-[state=checked]:bg-brand data-[state=checked]:shadow-[inset_0_1px_1px_rgba(0,0,0,0.12)] data-[state=unchecked]:bg-[#78788029] dark:border-white/10 dark:data-[state=unchecked]:bg-[#78788052]",
	{
		variants: {
			size: {
				sm: "h-[18px] w-8",
				default: "h-6 w-[54px]",
				lg: "h-7 w-16",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

const switchThumbVariants = cva(
	"pointer-events-none absolute top-1/2 left-[2px] block -translate-y-1/2 rounded-full border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] ring-0 transition-[width,transform,background-color,box-shadow,backdrop-filter] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-active/switch:bg-white/75 group-active/switch:backdrop-blur-xl group-active/switch:shadow-[0_2px_7px_rgba(0,0,0,0.24),inset_0_1px_1px_rgba(255,255,255,0.95)] data-[state=unchecked]:translate-x-0",
	{
		variants: {
			size: {
				sm: "h-3.5 w-[19px] group-active/switch:w-[22px] data-[state=checked]:translate-x-[9px] group-active/switch:data-[state=checked]:translate-x-1.5",
				default:
					"h-5 w-8 group-active/switch:w-[35px] data-[state=checked]:translate-x-[18px] group-active/switch:data-[state=checked]:translate-x-[15px]",
				lg: "h-6 w-[38px] group-active/switch:w-[42px] data-[state=checked]:translate-x-[22px] group-active/switch:data-[state=checked]:translate-x-[18px]",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export { switchThumbVariants, switchVariants }
