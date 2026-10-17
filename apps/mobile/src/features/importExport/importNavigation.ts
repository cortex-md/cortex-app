import { type Href, router } from "expo-router"

export type ImportStep = "obsidian" | "progress" | "obsidian-done" | "review" | "preview" | "done"

function stepHref(step: ImportStep): Href {
	return `/import/${step}` as Href
}

export function pushImportStep(step: ImportStep): void {
	router.push(stepHref(step))
}

export function replaceImportStep(step: ImportStep): void {
	router.replace(stepHref(step))
}
