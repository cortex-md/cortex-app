import { contextBridge, ipcRenderer } from "electron"
import type { InvokeResult } from "./contract"
import { EVENT_CHANNEL_PREFIX, INVOKE_CHANNEL } from "./contract"

contextBridge.exposeInMainWorld("cortex", {
	invoke: async (domain: string, method: string, args: unknown[]) => {
		const result = (await ipcRenderer.invoke(INVOKE_CHANNEL, domain, method, args)) as InvokeResult
		if (result.ok) return result.value
		throw Object.assign(new Error(result.message), result.code ? { code: result.code } : {})
	},
	on: (event: string, listener: (payload: unknown) => void) => {
		const channel = `${EVENT_CHANNEL_PREFIX}${event}`
		const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload)
		ipcRenderer.on(channel, handler)
		return () => {
			ipcRenderer.removeListener(channel, handler)
		}
	},
})
