import { reportAppError } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { useSyncExternalStore } from "react"

import { toast } from "@/features/feedback/useToast"
import {
	FIXTURE_TEMPLATES,
	type MarketplaceTemplate,
} from "@/features/marketplace/marketplaceFixtures"
import { presentSheet } from "@/features/navigation/routes"

export type TemplateKindFilter = "all" | "note" | "database"

interface MarketplaceExtrasState {
	addedTemplateIds: ReadonlySet<string>
}

const listeners = new Set<() => void>()
let state: MarketplaceExtrasState = {
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

export function applyCommunityTheme(familyName: string): void {
	void useSettingsStore
		.getState()
		.updateSetting("appearance", "theme", familyName)
		.catch((cause: unknown) =>
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
