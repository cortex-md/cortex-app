import type { Platform } from "@cortex/platform"

import { appApi } from "./app"
import { appearanceApi } from "./appearance"
import { appUpdatesApi } from "./appUpdates"
import { clipboardApi } from "./clipboard"
import { collabApi } from "./collab"
import { deviceApi } from "./device"
import { dialogApi } from "./dialog"
import { documentImportApi } from "./documentImport"
import { fsApi } from "./fs"
import { httpApi } from "./http"
import { keychainApi } from "./keychain"
import { notificationsApi } from "./notifications"
import { serverApi } from "./serverApi"
import { sharesApi, templateSharesApi } from "./shares"
import { storageApi } from "./storage"
import { syncApi } from "./sync"
import { vaultApi } from "./vault"
import { windowApi } from "./window"

export const expoPlatform: Platform = {
	app: appApi,
	appearance: appearanceApi,
	appUpdates: appUpdatesApi,
	auth: serverApi.auth,
	account: serverApi.account,
	capabilities: [
		"notifications",
		"notifications:sounds",
		"notifications:actions",
		"notifications:schedule",
	],
	clipboard: clipboardApi,
	collab: collabApi,
	device: deviceApi,
	devices: serverApi.devices,
	dialog: dialogApi,
	documentImport: documentImportApi,
	font: {
		listSystemFonts: async () => [],
	},
	fs: fsApi,
	http: httpApi,
	keychain: keychainApi,
	members: serverApi.members,
	shares: sharesApi,
	notifications: notificationsApi,
	remoteVault: serverApi.remoteVault,
	storage: storageApi,
	subscription: serverApi.subscription,
	sync: syncApi,
	templateShares: templateSharesApi,
	vault: vaultApi,
	window: windowApi,
	menu: { setState: async () => {} },
}
