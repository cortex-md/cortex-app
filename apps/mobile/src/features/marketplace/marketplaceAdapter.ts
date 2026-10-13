import { reportAppError } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { useSyncExternalStore } from "react"

import { toast } from "@/features/feedback/useToast"
import {
	FIXTURE_TEMPLATES,
	FIXTURE_THEMES,
	type MarketplaceTemplate,
	type MarketplaceTheme,
} from "@/features/marketplace/marketplaceFixtures"
import { presentSheet } from "@/features/navigation/routes"

export type TemplateKindFilter = "all" | "note" | "database"

interface MarketplaceExtrasState {
	installedThemeIds: ReadonlySet<string>
	addedTemplateIds: ReadonlySet<string>
}

const listeners = new Set<() => void>()
let state: MarketplaceExtrasState = {
	installedThemeIds: new Set(
		FIXTURE_THEMES.filter((theme) => theme.group === "installed").map((theme) => theme.id),
	),
	addedTemplateIds: new Set(),
}

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getState(): MarketplaceExtrasState {
	return state
}

export function useMarketplaceExtras(): MarketplaceExtrasState {
	return useSyncExternalStore(subscribe, getState, getState)
}

export function listThemes(): MarketplaceTheme[] {
	// stub: community themes come from the theme registry once mobile can render them
	return FIXTURE_THEMES
}

export function findTheme(id: string | null): MarketplaceTheme | null {
	return FIXTURE_THEMES.find((theme) => theme.id === id) ?? null
}

export function isThemeInstalled(extras: MarketplaceExtrasState, theme: MarketplaceTheme): boolean {
	return theme.builtIn || extras.installedThemeIds.has(theme.id)
}

export function installTheme(theme: MarketplaceTheme): void {
	// stub: community theme downloads are not available on mobile; the theme is marked installed in memory
	state = { ...state, installedThemeIds: new Set([...state.installedThemeIds, theme.id]) }
	notify()
}

export function applyTheme(theme: MarketplaceTheme): void {
	if (!theme.builtIn || !theme.scheme) {
		toast("Community themes are not available on mobile yet")
		return
	}
	const settings = useSettingsStore.getState()
	void Promise.all([
		settings.updateSetting("appearance", "theme", "default"),
		settings.updateSetting("appearance", "colorscheme", theme.scheme),
	]).catch((cause: unknown) =>
		reportAppError({
			operation: "update-setting",
			source: "mobile-marketplace",
			cause,
			userMessage: "Unable to change the theme.",
		}),
	)
}

export function listTemplates(): MarketplaceTemplate[] {
	// stub: team and marketplace templates come from the template registry and sync server
	return FIXTURE_TEMPLATES
}

export function findTemplate(id: string | null): MarketplaceTemplate | null {
	return FIXTURE_TEMPLATES.find((template) => template.id === id) ?? null
}

export function isTemplateInVault(
	extras: MarketplaceExtrasState,
	template: MarketplaceTemplate,
): boolean {
	return template.group === "vault" || extras.addedTemplateIds.has(template.id)
}

export function matchesTemplateKind(
	template: MarketplaceTemplate,
	filter: TemplateKindFilter,
): boolean {
	if (filter === "all") return true
	return filter === "database" ? template.isDatabase : !template.isDatabase
}

export function templateMeta(template: MarketplaceTemplate): string {
	const author = template.author.split(" · ")[0] ?? template.author
	return `${author} · ${template.isDatabase ? "Database" : "Note"}`
}

export function addTemplate(template: MarketplaceTemplate): void {
	// stub: marketplace template files are not downloaded on mobile yet; the template is marked added
	state = { ...state, addedTemplateIds: new Set([...state.addedTemplateIds, template.id]) }
	notify()
	toast(`Added ${template.name} to ${template.destination ?? "Templates"}`)
}

export function openTemplate(template: MarketplaceTemplate): void {
	presentSheet("from-template", { templateId: template.id })
}
