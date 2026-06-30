import type { Platform, Storage } from "@cortex/platform"
import { appDataDir } from "@tauri-apps/api/path"
import { App } from "./App"
import { Appearance } from "./Appearance"
import { AppUpdates } from "./AppUpdates"
import { Auth } from "./Auth"
import { Device } from "./Device"
import { Devices } from "./Devices"
import { Dialog } from "./Dialog"
import { DocumentExport } from "./DocumentExport"
import { DocumentImport } from "./DocumentImport"
import { FileSystem } from "./FileSystem"
import { Font } from "./Font"
import { Http } from "./Http"
import { Keychain } from "./Keychain"
import { Members } from "./Members"
import { NativeWindow } from "./NativeWindow"
import { Notifications } from "./Notifications"
import { RemoteVault } from "./RemoteVault"
import { Subscription } from "./Subscription"
import { Sync } from "./Sync"
import { Vault } from "./Vault"

const storage: Storage = {
	getAppDataDir: async () => await appDataDir(),
	getVaultConfigDir: async (vaultPath) => `${vaultPath}/.cortex`,
}

export const tauriPlatform: Platform = {
	appearance: new Appearance(),
	window: new NativeWindow(),
	fs: new FileSystem(),
	dialog: new Dialog(),
	documentImport: new DocumentImport(),
	documentExport: new DocumentExport(),
	vault: new Vault(),
	storage,
	app: new App(),
	appUpdates: new AppUpdates(),
	auth: new Auth(),
	font: new Font(),
	http: new Http(),
	keychain: new Keychain(),
	device: new Device(),
	sync: new Sync(),
	remoteVault: new RemoteVault(),
	subscription: new Subscription(),
	members: new Members(),
	devices: new Devices(),
	notifications: new Notifications(),
	capabilities: ["menu", "hotkeys", "notifications", "notifications:sounds"],
}
