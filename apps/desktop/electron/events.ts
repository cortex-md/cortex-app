import { BrowserWindow } from "electron"

export function emitToRenderer(event: string, payload?: unknown): void {
	const channel = `cortex:event:${event}`
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send(channel, payload)
		}
	}
}
