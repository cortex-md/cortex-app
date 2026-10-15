import { cn } from "@cortex/ui/lib/utils"

export function SyncStatus({ label, className }: { label: string; className?: string }) {
	return (
		<span className={cn("inline-flex items-center gap-[5px]", className)}>
			<i className="size-[7px] rounded-full bg-status-success-foreground animate-product-status-dot motion-reduce:animate-none" />
			{label}
		</span>
	)
}

export function TypedLine({ text, device }: { text: string; device: "mac" | "phone" }) {
	return (
		<span
			className={cn(
				"inline-block max-w-0 overflow-hidden align-bottom whitespace-nowrap motion-reduce:max-w-none motion-reduce:animate-none",
				device === "mac"
					? "border-r-2 border-brand animate-product-type-mac motion-reduce:border-r-0"
					: "animate-product-type-phone",
			)}
		>
			{text}
		</span>
	)
}
