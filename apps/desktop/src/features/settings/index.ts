import type { AppSettings } from "@cortex/settings"

export type UpdateSettingFn = <K extends keyof AppSettings>(
	section: K,
	key: keyof AppSettings[K],
	value: unknown,
) => void | Promise<void>
