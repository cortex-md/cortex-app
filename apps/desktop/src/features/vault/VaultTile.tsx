import { cn } from "@cortex/ui"
import { getVaultInitial } from "./vaultDisplay"

const TILE_SIZE = {
	sm: "size-[22px] rounded-md text-[10px]",
	md: "size-7 rounded-lg text-[11px]",
	lg: "size-11 rounded-xl text-[18px]",
} as const

interface VaultTileProps {
	name: string
	color: string
	size?: keyof typeof TILE_SIZE
	className?: string
}

export function VaultTile({ name, color, size = "md", className }: VaultTileProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center leading-none font-bold text-white select-none",
				TILE_SIZE[size],
				className,
			)}
			style={{ backgroundColor: color }}
		>
			{getVaultInitial(name)}
		</span>
	)
}
