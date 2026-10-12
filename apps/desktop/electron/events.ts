import { BrowserWindow } from "electron"
import type { MainEventName, MainEvents } from "./contract"
import { EVENT_CHANNEL_PREFIX } from "./contract"

type EventArgs<E extends MainEventName> = MainEvents[E] extends undefined ? [E] : [E, MainEvents[E]]

export function emitToRenderer<E extends MainEventName>(...[event, payload]: EventArgs<E>): void {
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send(`${EVENT_CHANNEL_PREFIX}${event}`, payload)
		}
	}
}
