import type { MainWindowActions } from "./mainWindowActions"
import { sendWindowAction } from "./windowBridge"

type ActionPayload<K extends keyof MainWindowActions> = Parameters<MainWindowActions[K]>[0]

export function runInMainWindow<K extends keyof MainWindowActions>(
	name: K,
	...payload: ActionPayload<K> extends undefined ? [] : [ActionPayload<K>]
): void {
	sendWindowAction(name, payload[0])
}
