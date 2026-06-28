import { Slider as SliderPrimitive } from "radix-ui"
import * as React from "react"

import { nativeAccentFill } from "./lib/native-styles"
import { cn } from "./lib/utils"

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	const _values = React.useMemo(
		() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
		[value, defaultValue, min],
	)
	const thumbSlots = React.useMemo(
		() => Array.from({ length: _values.length }, (_, thumbPosition) => `thumb-${thumbPosition}`),
		[_values.length],
	)

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			className={cn(
				"group/slider relative flex h-[29px] w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-[29px] data-[orientation=vertical]:flex-col",
				className,
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className={cn(
					"relative grow overflow-hidden rounded-full bg-[#78788029] shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)] data-[orientation=horizontal]:h-[3px] data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[3px] dark:bg-[#78788052]",
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn(
						"absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
						nativeAccentFill,
					)}
				/>
			</SliderPrimitive.Track>
			{thumbSlots.map((thumbSlot) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					key={thumbSlot}
					className="block size-5 shrink-0 rounded-full border border-white/80 bg-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] outline-hidden backdrop-blur-xl transition-[transform,border-color,background-color,box-shadow,opacity] duration-150 ease-out group-active/slider:scale-110 group-active/slider:bg-white/75 group-active/slider:shadow-[0_2px_7px_rgba(0,0,0,0.24)] focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
				/>
			))}
		</SliderPrimitive.Root>
	)
}

export { Slider }
