import {
	addPublicNoteTemplate,
	getErrorMessage,
	listMarketTemplates,
	type OpenedPublicTemplate,
	openPublicTemplate,
	reportAppError,
	useTemplateStore,
	useVaultStore,
} from "@cortex/core"
import type { PublicTemplateInfo } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useEffect, useSyncExternalStore } from "react"

import { toast } from "@/features/feedback/useToast"
import type { MarketplaceTemplate } from "@/features/marketplace/marketplaceTypes"
import { presentSheet } from "@/features/navigation/routes"

export type TemplateKindFilter = "all" | "note" | "database"

interface MarketplaceExtrasState {
	addedTemplateIds: ReadonlySet<string>
	templates: MarketplaceTemplate[]
}

const listeners = new Set<() => void>()
const openedTemplates = new Map<string, OpenedPublicTemplate>()
let state: MarketplaceExtrasState = { addedTemplateIds: new Set(), templates: [] }
let loading: Promise<void> | null = null

function setState(next: Partial<MarketplaceExtrasState>): void {
	state = { ...state, ...next }
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

function formatUpdated(updatedAt: string): string {
	const date = new Date(updatedAt)
	if (Number.isNaN(date.getTime())) return ""
	return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function toMarketplaceTemplate(info: PublicTemplateInfo): MarketplaceTemplate {
	return {
		id: info.slug,
		name: info.name,
		author: info.ownerName,
		isDatabase: info.kind === "database",
		group: "market",
		version: String(info.version),
		updated: formatUpdated(info.updatedAt),
		source: "Cortex marketplace",
		includes: `${info.fileCount} ${info.fileCount === 1 ? "file" : "files"}`,
		lead: info.description,
		files: [],
		preview: [],
	}
}

function loadMarketTemplates(): Promise<void> {
	loading ??= listMarketTemplates({})
		.then((templates) => setState({ templates: templates.map(toMarketplaceTemplate) }))
		.catch(() => {
			loading = null
		})
	return loading
}

export function useMarketplaceExtras(): MarketplaceExtrasState {
	useEffect(() => {
		void loadMarketTemplates()
	}, [])
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
	return state.templates
}

export function findTemplate(id: string | null): MarketplaceTemplate | null {
	return state.templates.find((template) => template.id === id) ?? null
}

export function rememberOpenedPublicTemplate(slug: string, opened: OpenedPublicTemplate): void {
	openedTemplates.set(slug, opened)
}

export function getOpenedPublicTemplate(slug: string): OpenedPublicTemplate | null {
	return openedTemplates.get(slug) ?? null
}

async function openPublic(slug: string): Promise<OpenedPublicTemplate> {
	const cached = openedTemplates.get(slug)
	if (cached) return cached
	const opened = await openPublicTemplate(slug)
	openedTemplates.set(slug, opened)
	return opened
}

export function isTemplateInVault(
	extras: MarketplaceExtrasState,
	template: MarketplaceTemplate,
): boolean {
	if (template.group === "vault" || extras.addedTemplateIds.has(template.id)) return true
	return useTemplateStore
		.getState()
		.templates.some((candidate) => candidate.remote?.id === template.id)
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

export function openTemplate(template: MarketplaceTemplate): void {
	void openPublic(template.id)
		.then(() => presentSheet("from-template", { templateId: template.id }))
		.catch((error: unknown) => toast(getErrorMessage(error)))
}

export function addTemplate(template: MarketplaceTemplate): void {
	if (template.isDatabase) {
		openTemplate(template)
		return
	}
	const vault = useVaultStore.getState().vault
	if (!vault) {
		toast("Open a vault first")
		return
	}
	void openPublic(template.id)
		.then((opened) =>
			addPublicNoteTemplate({ name: vault.name, path: vault.path }, opened, "market"),
		)
		.then(() => {
			setState({ addedTemplateIds: new Set([...state.addedTemplateIds, template.id]) })
			toast(`Added ${template.name} to Templates`)
		})
		.catch((error: unknown) => toast(getErrorMessage(error)))
}
