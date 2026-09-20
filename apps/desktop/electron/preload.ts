import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("cortex", {
	invoke: (command: string, args: Record<string, unknown> = {}) =>
		ipcRenderer.invoke("cortex:invoke", command, args),
	on: (event: string, listener: (payload: unknown) => void) => {
		const channel = `cortex:event:${event}`
		const handler = (_ipcEvent: Electron.IpcRendererEvent, payload: unknown) => {
			listener(payload)
		}
		ipcRenderer.on(channel, handler)
		return () => {
			ipcRenderer.removeListener(channel, handler)
		}
	},
})
