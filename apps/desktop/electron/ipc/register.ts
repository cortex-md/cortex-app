import { app, ipcMain, shell } from "electron"
import type { MainApi } from "../contract"
import { INVOKE_CHANNEL } from "../contract"
import { menuApi } from "../menu"
import { assertExternalUrl, assertTrustedSender } from "../security"
import { appUpdatesApi } from "../services/appUpdates"
import { collabApi } from "../services/collab"
import { deviceApi } from "../services/device"
import { dialogApi } from "../services/dialog"
import { documentsApi } from "../services/documents"
import { fontApi } from "../services/fonts"
import { fsApi } from "../services/fs"
import { keychainApi } from "../services/keychain"
import { noteSharesApi } from "../services/noteShares"
import { notificationsApi } from "../services/notifications"
import { serverApi } from "../services/serverApi"
import { syncService } from "../services/syncBridge"
import { templateSharesApi } from "../services/templateShares"
import { vaultApi } from "../services/vault"
import { getAppearanceSnapshot } from "../window"
import { windowApi } from "../windows"
import { runWithSender } from "./sender"

const mainApi: MainApi = {
	fs: fsApi,
	vault: vaultApi,
	dialog: dialogApi,
	documents: documentsApi,
	app: {
		getVersion: async () => app.getVersion(),
		getDataDir: async () => app.getPath("userData"),
		openExternalUrl: async (url) => await shell.openExternal(assertExternalUrl(url)),
		getAppearanceSnapshot: async () => getAppearanceSnapshot(),
	},
	window: windowApi,
	menu: menuApi,
	appUpdates: appUpdatesApi,
	notifications: notificationsApi,
	font: fontApi,
	keychain: keychainApi,
	device: deviceApi,
	auth: serverApi.auth,
	account: serverApi.account,
	subscription: serverApi.subscription,
	remoteVault: serverApi.remoteVault,
	members: serverApi.members,
	shares: noteSharesApi,
	templateShares: templateSharesApi,
	devices: serverApi.devices,
	sync: syncService,
	collab: collabApi,
}

function resolveHandler(domain: string, method: string): (...args: unknown[]) => unknown {
	const domainApi = Object.hasOwn(mainApi, domain)
		? (mainApi[domain as keyof MainApi] as Record<string, unknown>)
		: null
	const handler = domainApi && Object.hasOwn(domainApi, method) ? domainApi[method] : null
	if (typeof handler !== "function") {
		throw new Error(`Unknown IPC method: ${domain}.${method}`)
	}
	return handler as (...args: unknown[]) => unknown
}

export function registerIpcHandlers(): void {
	ipcMain.handle(INVOKE_CHANNEL, async (event, domain: string, method: string, args: unknown[]) => {
		try {
			assertTrustedSender(event)
			const handler = resolveHandler(domain, method)
			const value = await runWithSender(event.sender, () =>
				handler(...(Array.isArray(args) ? args : [])),
			)
			return { ok: true, value }
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			const code = (err as NodeJS.ErrnoException).code
			if (code !== "ENOENT") console.error(`[ipc] ${domain}.${method} failed:`, err)
			return { ok: false, message: err.message, code }
		}
	})
}
