import type { Platform, Storage } from "@cortex/platform"
import { App } from "./App"
import { Appearance } from "./Appearance"
import { AppUpdates } from "./AppUpdates"
import { Auth } from "./Auth"
import { invoke } from "./bridge"
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
	getAppDataDir: async () => await invoke<string>("app_get_data_dir"),
	getVaultConfigDir: async (vaultPath) => `${vaultPath}/.cortex`,
}

export const electronPlatform: Platform = {
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
