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
	value: string
}

export function getVaultColorOptions(colors: MobileColors): VaultColorOption[] {
	return [
		{ label: "Rose", value: colors.tintFill },
		{ label: "Blue", value: colors.headingBlue },
		{ label: "Green", value: colors.swatchGreen },
		{ label: "Yellow", value: colors.swatchYellow },
		{ label: "Violet", value: colors.headingViolet },
		{ label: "Red", value: colors.swatchRed },
		{ label: "Graphite", value: colors.secondaryLabel },
	]
}

export function findVaultIcon(icon: string): VaultIconOption {
	return vaultIconOptions.find((option) => option.icon === icon) ?? vaultIconOptions[0]
}
