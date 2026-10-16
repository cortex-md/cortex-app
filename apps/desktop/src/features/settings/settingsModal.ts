import { createModalStore } from "@/utils/createModalStore"
import type { SettingsRevealTarget } from "./settingsReveal"

export const settingsModal = createModalStore<SettingsRevealTarget>()

let nonce = 0

export function openSettings(
	section = "general",
	fieldId?: string | null,
	options: { focus?: boolean; fallbackId?: string } = {},
): void {
	nonce += 1
	settingsModal.open({
		section,
		fieldId: fieldId ?? undefined,
		fallbackId: options.fallbackId,
		focus: options.focus ?? false,
		nonce,
	})
}

export function closeSettings(): void {
	settingsModal.close()
}
