import type { SymbolName } from "@/components/ui/Symbol"

export const PROPERTIES_ICON: SymbolName = { sf: "list.bullet.rectangle", md: "list_alt" }

export function notePropertiesLabel(count: number): string {
	return count > 0 ? `Properties · ${count}` : "Properties"
}
