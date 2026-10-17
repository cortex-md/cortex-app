import type { ResetPasswordTarget } from "@cortex/core"
import type { ObsidianImportTarget } from "@cortex/import-export"
import { createModalStore } from "./createModalStore"

export type QuickFinderRequest =
	| { kind: "open"; query?: string }
	| { kind: "relink-bookmark"; bookmarkPath: string; query: string }

export interface CommandPaletteRequest {
	query: string
}

export type AuthView = "login" | "register"

export interface AuthTarget {
	view: AuthView
	returnTo: string | null
}

export interface CreateFromTemplateTarget {
	templateId: string | null
}

export interface NoteHistoryTarget {
	filePath: string
}

export interface NoteShareTarget {
	filePath: string
}

export interface ManageAccessTarget {
	filePath: string
}

export type { ObsidianImportTarget, ResetPasswordTarget }

const DEFAULT_QUICK_FINDER_REQUEST: QuickFinderRequest = { kind: "open" }

export const quickFinderModal = createModalStore<QuickFinderRequest>()
export const commandPaletteModal = createModalStore<CommandPaletteRequest>()
export const tagPickerModal = createModalStore<true>()
export const createFromTemplateModal = createModalStore<CreateFromTemplateTarget>()
export const authModal = createModalStore<AuthTarget>()
export const resetPasswordModal = createModalStore<ResetPasswordTarget>()
export const obsidianImportModal = createModalStore<ObsidianImportTarget>()
export const noteHistoryModal = createModalStore<NoteHistoryTarget>()
export const noteShareModal = createModalStore<NoteShareTarget>()
export const manageAccessModal = createModalStore<ManageAccessTarget>()

export function toggleQuickFinder(): void {
	if (quickFinderModal.getTarget()) quickFinderModal.close()
	else quickFinderModal.open(DEFAULT_QUICK_FINDER_REQUEST)
}

export function openQuickFinder(request: QuickFinderRequest = DEFAULT_QUICK_FINDER_REQUEST): void {
	quickFinderModal.open(request)
}

export function toggleCommandPalette(): void {
	if (commandPaletteModal.getTarget()) commandPaletteModal.close()
	else commandPaletteModal.open({ query: "" })
}

export function openCommandPaletteFromQuickFinder(query: string): void {
	quickFinderModal.close()
	commandPaletteModal.open({ query })
}

export function openQuickFinderFromCommandPalette(query: string): void {
	commandPaletteModal.close()
	quickFinderModal.open({ kind: "open", query })
}

export function toggleTagPicker(): void {
	if (tagPickerModal.getTarget()) tagPickerModal.close()
	else tagPickerModal.open(true)
}

export function openCreateFromTemplate(templateId?: string): void {
	createFromTemplateModal.open({ templateId: templateId ?? null })
}

export function closeCreateFromTemplate(): void {
	createFromTemplateModal.close()
}

export function openAuth(view: AuthView = "login", returnTo: string | null = null): void {
	authModal.open({ view, returnTo })
}

export function closeAuth(): void {
	authModal.close()
}
