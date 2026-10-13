import { BookOpen, Folder, type LucideIcon, Sparkles } from "lucide-react-native"

import type { MobileColors } from "@/theme/colors"

export interface VaultIconOption {
	Icon: LucideIcon
	icon: string
	label: string
}

export const vaultIconOptions: VaultIconOption[] = [
	{ Icon: BookOpen, icon: "book-open", label: "Book" },
	{ Icon: Folder, icon: "folder", label: "Folder" },
	{ Icon: Sparkles, icon: "sparkles", label: "Spark" },
]

export interface VaultColorOption {
	label: string
	hex: string
}

export function getVaultColorOptions(colors: MobileColors): VaultColorOption[] {
	return [
		{ label: "Rose", hex: colors.tintFill },
		{ label: "Blue", hex: colors.headingBlue },
		{ label: "Green", hex: colors.swatchGreen },
		{ label: "Yellow", hex: colors.swatchYellow },
		{ label: "Violet", hex: colors.headingViolet },
		{ label: "Red", hex: colors.swatchRed },
		{ label: "Graphite", hex: colors.secondaryLabel },
	]
}

export function findVaultIcon(icon: string): VaultIconOption {
	return vaultIconOptions.find((option) => option.icon === icon) ?? vaultIconOptions[0]
}
