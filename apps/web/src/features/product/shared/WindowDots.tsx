import { cn } from "@cortex/ui/lib/utils"

export function WindowDots({ className }: { className?: string }) {
	return (
		<>
			<i className={cn("size-[11px] rounded-full bg-sep", className)} />
			<i className={cn("size-[11px] rounded-full bg-sep", className)} />
			<i className={cn("size-[11px] rounded-full bg-sep", className)} />
		</>
	)
}
