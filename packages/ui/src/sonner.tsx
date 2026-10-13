import { Toaster as Sonner, type ToasterProps, toast } from "sonner"

import { cn } from "./lib/utils"

function Toaster({ className, toastOptions, ...props }: ToasterProps) {
	return (
		<Sonner
			data-slot="toaster"
			position="bottom-center"
			offset={52}
			gap={8}
			className={cn("toaster group", className)}
			toastOptions={{
				...toastOptions,
				unstyled: true,
				classNames: {
					toast:
						"flex items-center gap-3 rounded-xl bg-[var(--tooltip-bg)] py-2 pr-2 pl-3.5 text-[13px] leading-none font-medium text-[var(--tooltip-text)] shadow-floating",
					title: "flex-1",
					description: "text-[12px] opacity-80",
					actionButton:
						"h-[26px] rounded-lg border-0 bg-[color-mix(in_srgb,var(--tooltip-text)_14%,transparent)] px-2.5 text-[12px] leading-none font-semibold text-[var(--tooltip-text)]",
					cancelButton:
						"h-[26px] rounded-lg border-0 bg-transparent px-2.5 text-[12px] leading-none font-semibold text-[var(--tooltip-text)] opacity-80",
					icon: "[&_svg]:size-4",
					...toastOptions?.classNames,
				},
			}}
			{...props}
		/>
	)
}

export { Toaster, toast }
