import type { FormModifier, FormTheme } from "@/components/ui/formTypes"

const NONE: FormModifier = { $type: "none" }

export function useFormTheme(): FormTheme {
	return { accent: NONE, label: NONE, row: [], secondary: NONE, tertiary: NONE, toggle: NONE }
}
