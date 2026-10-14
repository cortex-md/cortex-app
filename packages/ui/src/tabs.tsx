import type { VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"
import type * as React from "react"

import { nativeControlFocusRing } from "./lib/native-styles"
import { cn } from "./lib/utils"
import { tabsListVariants } from "./tabs-variants"

function Tabs({
	className,
	orientation = "horizontal",
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			orientation={orientation}
			className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
			{...props}
		/>
	)
}

function TabsList({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	)
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"relative inline-flex h-7 min-w-7 flex-1 cursor-default items-center justify-center gap-1.5 rounded-full border border-transparent px-1.5 py-1 text-[13px] font-medium leading-4 whitespace-nowrap text-foreground/70 outline-none transition-[background-color,color,box-shadow] duration-[120ms] ease-out group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				nativeControlFocusRing,
				"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground dark:group-data-[variant=line]/tabs-list:text-muted-foreground dark:group-data-[variant=line]/tabs-list:hover:text-foreground",
				"group-data-[variant=default]/tabs-list:h-[30px] group-data-[variant=default]/tabs-list:min-w-[30px] group-data-[variant=default]/tabs-list:border-0 group-data-[variant=default]/tabs-list:px-3.5 group-data-[variant=default]/tabs-list:py-0 group-data-[variant=default]/tabs-list:text-[14px] group-data-[variant=default]/tabs-list:leading-[18px] group-data-[variant=default]/tabs-list:text-text-secondary group-data-[variant=default]/tabs-list:hover:text-text-primary",
				"group-data-[variant=default]/tabs-list:data-[state=active]:bg-[var(--surface-raised,var(--bg-elevated))] group-data-[variant=default]/tabs-list:data-[state=active]:text-text-primary group-data-[variant=default]/tabs-list:data-[state=active]:shadow-[var(--shadow-raised)] group-data-[variant=default]/tabs-list:data-[state=active]:focus-visible:shadow-[0_0_0_2px_var(--bg-primary),0_0_0_4px_color-mix(in_srgb,var(--border-focus)_55%,transparent)]",
				"after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
				className,
			)}
			{...props}
		/>
	)
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	)
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
