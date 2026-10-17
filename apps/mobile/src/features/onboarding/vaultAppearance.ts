import { VAULT_COLORS } from "@cortex/core"

import type { SymbolName } from "@/components/ui/Symbol"
import type { FormPickerOption } from "@/features/onboarding/formControlTypes"

export interface VaultIconOption extends FormPickerOption<string> {
	symbol: SymbolName
}

export const vaultIconOptions: VaultIconOption[] = [
	{ label: "Book", symbol: { md: "menu_book", sf: "book" }, value: "book-open" },
	{ label: "Folder", symbol: { md: "folder", sf: "folder" }, value: "folder" },
	{ label: "Spark", symbol: { md: "auto_awesome", sf: "sparkles" }, value: "sparkles" },
]

const vaultColorLabels = ["Rose", "Amber", "Green", "Teal", "Sky", "Violet", "Slate"]

export const vaultColorOptions: FormPickerOption<string>[] = VAULT_COLORS.map((value, index) => ({
	label: vaultColorLabels[index] ?? value,
	value,
}))

export const DEFAULT_VAULT_COLOR: string = VAULT_COLORS[0]

export function findVaultIcon(icon: string | null | undefined): VaultIconOption {
	return vaultIconOptions.find((option) => option.value === icon) ?? vaultIconOptions[0]
}
