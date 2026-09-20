import { app, ipcMain, shell } from "electron"
import { refreshMenuRecents } from "../menu"
import * as auth from "../services/auth"
import * as device from "../services/device"
import * as devicesApi from "../services/devicesApi"
import * as dialogService from "../services/dialog"
import * as documents from "../services/documents"
import * as fonts from "../services/fonts"
import * as fsService from "../services/fs"
import * as httpClient from "../services/httpClient"
import * as keychain from "../services/keychain"
import * as members from "../services/members"
import * as notifications from "../services/notifications"
import * as remoteVault from "../services/remoteVault"
import * as registry from "../services/registry"
import * as appUpdates from "../services/appUpdates"
import * as subscription from "../services/subscription"
import { handleSyncInvoke } from "../services/syncBridge"
import * as vault from "../services/vault"
import * as watcher from "../services/watcher"
import {
	closeCurrentWindow,
	focusMainWindow,
	getAppearanceSnapshot,
	restartApp,
} from "../window"

type Args = Record<string, unknown>

function arg<T>(args: Args, key: string): T {
	return args[key] as T
}

const handlers: Record<string, (args: Args) => unknown | Promise<unknown>> = {
	read_file: (args) => fsService.readFile(arg<string>(args, "path")),
	read_file_snapshot: (args) => fsService.readFileSnapshot(arg<string>(args, "path")),
	read_binary_file: (args) => fsService.readBinaryFile(arg<string>(args, "path")),
	write_file_snapshot: (args) =>
		fsService.writeFileSnapshot(arg<string>(args, "path"), arg<string>(args, "content")),
	write_file: (args) => fsService.writeFile(arg<string>(args, "path"), arg<string>(args, "content")),
	atomic_write_file: (args) =>
		fsService.atomicWriteFile(arg<string>(args, "path"), arg<string>(args, "content")),
	write_binary_file: (args) =>
		fsService.writeBinaryFile(arg<string>(args, "path"), arg<number[]>(args, "data")),
	delete_file: (args) => fsService.deleteFile(arg<string>(args, "path")),
	rename_file: (args) =>
		fsService.renameFile(arg<string>(args, "oldPath"), arg<string>(args, "newPath")),
	create_dir: (args) => fsService.createDir(arg<string>(args, "path")),
	hash_file: (args) => fsService.hashFile(arg<string>(args, "path")),
	get_file_metadata: (args) => fsService.getFileMetadata(arg<string>(args, "path")),
	list_dir: (args) => fsService.listDir(arg<string>(args, "path")),
	download_file: (args) =>
		fsService.downloadFile(arg<string>(args, "url"), arg<string>(args, "destPath")),
	download_text: (args) => fsService.downloadText(arg<string>(args, "url")),
	download_and_extract: (args) =>
		fsService.downloadAndExtract(arg<string>(args, "url"), arg<string>(args, "destDir")),

	open_vault: (args) => vault.openVault(arg<string>(args, "path")),
	scan_vault: (args) => vault.scanVault(arg<string>(args, "path")),
	get_vault_metadata: (args) => vault.getVaultMetadata(arg<string>(args, "path")),

	read_vault_registry: () => registry.readVaultRegistry(),
	update_vault_registry: (args) =>
		registry.updateVaultRegistry(
			arg<string>(args, "uuid"),
			arg<string>(args, "path"),
			arg<string>(args, "name"),
			arg<string | null | undefined>(args, "icon"),
			arg<string | null | undefined>(args, "color"),
		),
	remove_from_vault_registry: (args) =>
		registry.removeFromVaultRegistry(arg<string>(args, "uuid")),
	refresh_menu_recents: () => refreshMenuRecents(),

	start_watching: (args) =>
		watcher.startWatching(
			arg<string>(args, "path"),
			arg<boolean | undefined>(args, "includeHidden") ?? false,
			arg<boolean | undefined>(args, "followSymlinks") ?? false,
		),
	stop_watching: (args) => watcher.stopWatching(arg<string>(args, "watcherId")),

	keychain_get: (args) => keychain.get(arg<string>(args, "key")),
	keychain_set: (args) => keychain.set(arg<string>(args, "key"), arg<string>(args, "value")),
	keychain_delete: (args) => keychain.delete(arg<string>(args, "key")),

	get_device_id: () => device.getDeviceId(),
	get_device_info: () => device.getDeviceInfo(),

	auth_login: (args) =>
		auth.login(
			arg<string>(args, "serverUrl"),
			arg<string>(args, "email"),
			arg<string>(args, "password"),
		),
	auth_register: (args) =>
		auth.register(
			arg<string>(args, "serverUrl"),
			arg<string>(args, "email"),
			arg<string>(args, "password"),
			arg<string>(args, "displayName"),
		),
	auth_logout: (args) =>
		auth.logout(arg<string>(args, "serverUrl"), arg<boolean>(args, "allDevices")),
	auth_get_status: (args) => auth.getAuthStatus(arg<string | null | undefined>(args, "serverUrl")),
	auth_get_current_user: (args) =>
		auth.getCurrentUser(arg<string | null | undefined>(args, "serverUrl")),

	subscription_get_status: (args) =>
		subscription.subscriptionGetStatus(arg<string>(args, "serverUrl")),

	remote_vault_create: (args) =>
		remoteVault.remoteVaultCreate(
			arg<string>(args, "name"),
			arg<string | null | undefined>(args, "description"),
		),
	remote_vault_list: () => remoteVault.remoteVaultList(),
	remote_vault_get: (args) => remoteVault.remoteVaultGet(arg<string>(args, "vaultId")),
	remote_vault_update: (args) =>
		remoteVault.remoteVaultUpdate(
			arg<string>(args, "vaultId"),
			arg<string | null | undefined>(args, "name"),
			arg<string | null | undefined>(args, "description"),
		),
	remote_vault_delete: (args) => remoteVault.remoteVaultDelete(arg<string>(args, "vaultId")),
	remote_vault_link: (args) =>
		remoteVault.remoteVaultLink(arg<string>(args, "vaultPath"), arg<string>(args, "remoteVaultId")),
	remote_vault_unlink: (args) => remoteVault.remoteVaultUnlink(arg<string>(args, "vaultPath")),
	remote_vault_get_link: (args) => remoteVault.remoteVaultGetLink(arg<string>(args, "vaultPath")),
	sync_config_read: (args) => remoteVault.syncConfigRead(arg<string>(args, "vaultPath")),
	sync_config_update: (args) =>
		remoteVault.syncConfigUpdate(
			arg<string>(args, "vaultPath"),
			arg<string>(args, "key"),
			args.value,
		),

	vault_members_list: (args) => members.vaultMembersList(arg<string>(args, "vaultId")),
	vault_member_update_role: (args) =>
		members.vaultMemberUpdateRole(
			arg<string>(args, "vaultId"),
			arg<string>(args, "userId"),
			arg<string>(args, "role"),
		),
	vault_member_remove: (args) =>
		members.vaultMemberRemove(arg<string>(args, "vaultId"), arg<string>(args, "userId")),
	vault_invite_create: (args) =>
		members.vaultInviteCreate(
			arg<string>(args, "vaultId"),
			arg<string>(args, "inviteeEmail"),
			arg<string>(args, "role"),
			arg<string>(args, "encryptedVaultKey"),
		),
	vault_invites_list: (args) => members.vaultInvitesList(arg<string>(args, "vaultId")),
	vault_invite_delete: (args) =>
		members.vaultInviteDelete(arg<string>(args, "vaultId"), arg<string>(args, "inviteId")),
	vault_my_invites: () => members.vaultMyInvites(),
	vault_invite_accept: (args) => members.vaultInviteAccept(arg<string>(args, "inviteId")),

	devices_list: () => devicesApi.devicesList(),
	device_get: (args) => devicesApi.deviceGet(arg<string>(args, "deviceId")),
	device_rename: (args) =>
		devicesApi.deviceRename(arg<string>(args, "deviceId"), arg<string>(args, "deviceName")),
	device_revoke: (args) => devicesApi.deviceRevoke(arg<string>(args, "deviceId")),
	device_update_sync_cursor: (args) =>
		devicesApi.deviceUpdateSyncCursor(
			arg<string>(args, "deviceId"),
			arg<number>(args, "lastSyncEventId"),
		),

	dialog_pick_folder: (args) => dialogService.pickFolder(args as never),
	dialog_pick_file: (args) => dialogService.pickFile(args as never),
	dialog_pick_files: (args) => dialogService.pickFiles(args as never),
	dialog_save_file: (args) => dialogService.saveFile(args as never),
	dialog_show_confirm: (args) => dialogService.showConfirm(args as never),
	dialog_show_alert: (args) => dialogService.showAlert(args as never),
	dialog_reveal_folder: (args) => dialogService.revealFolder(arg<string>(args, "path")),
	dialog_show_context_menu: (args) => dialogService.showContextMenu(args as never),

	list_system_fonts: () => fonts.listSystemFonts(),
	export_html_to_pdf: (args) =>
		documents.exportHtmlToPdf(
			arg<string>(args, "path"),
			arg<string>(args, "html"),
			arg<string>(args, "title"),
		),
	extract_pdf_text: (args) => documents.extractPdfText(arg<string>(args, "path")),

	notifications_get_permission: () => notifications.getPermission(),
	notifications_request_permission: () => notifications.requestPermission(),
	notifications_send: (args) =>
		notifications.send(arg<notifications.NativeNotificationRequest>(args, "notification")),

	app_get_version: () => app.getVersion(),
	app_get_data_dir: () => app.getPath("userData"),
	app_open_external_url: (args) => shell.openExternal(arg<string>(args, "url")),

	appearance_get_snapshot: () => getAppearanceSnapshot(),
	window_close_current: () => closeCurrentWindow(),
	window_focus_main: () => focusMainWindow(),
	restart_app: () => restartApp(),

	sync_get_note_metadata: (args) => handleSyncInvoke("sync_get_note_metadata", args),
	sync_update_preferences: (args) => handleSyncInvoke("sync_update_preferences", args),
	sync_check_vault_encryption: (args) => handleSyncInvoke("sync_check_vault_encryption", args),
	sync_create_vault_key: (args) => handleSyncInvoke("sync_create_vault_key", args),
	sync_unlock_vault_key: (args) => handleSyncInvoke("sync_unlock_vault_key", args),
	sync_start: (args) => handleSyncInvoke("sync_start", args),
	sync_stop: () => handleSyncInvoke("sync_stop"),
	sync_force_sync_file: (args) => handleSyncInvoke("sync_force_sync_file", args),
	sync_resolve_conflict: (args) => handleSyncInvoke("sync_resolve_conflict", args),
	sync_get_conflicts: (args) => handleSyncInvoke("sync_get_conflicts", args),
	sync_get_version_history: (args) => handleSyncInvoke("sync_get_version_history", args),
	sync_download_version: (args) => handleSyncInvoke("sync_download_version", args),
	sync_restore_version: (args) => handleSyncInvoke("sync_restore_version", args),
	sync_list_deleted_files: (args) => handleSyncInvoke("sync_list_deleted_files", args),
	sync_restore_deleted_file: (args) => handleSyncInvoke("sync_restore_deleted_file", args),

	app_update_status: () => appUpdates.getStatus(),
	app_update_check: (args) => appUpdates.checkForUpdate(arg<string>(args, "source")),
	app_update_install: () => appUpdates.installUpdate(),
	app_update_fetch_changelog: (args) =>
		appUpdates.fetchChangelog(arg<string>(args, "version")),
}

export function registerIpcHandlers(): void {
	httpClient.loadServerUrl()
	ipcMain.handle("cortex:invoke", async (_event, command: string, args: Args = {}) => {
		const handler = handlers[command]
		if (!handler) {
			throw new Error(`Unknown command: ${command}`)
		}
		return await handler(args ?? {})
	})
}
