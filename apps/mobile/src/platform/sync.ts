import type { Platform } from "@cortex/platform"

import { serverApi } from "./serverApi"
import { noopUnsubscribe, unsupportedPhase1 } from "./unsupported"

export const syncApi = {
	checkVaultEncryption: serverApi.checkVaultEncryption,
	createVaultKey: () => unsupportedPhase1("sync.createVaultKey"),
	downloadVersion: () => unsupportedPhase1("sync.downloadVersion"),
	forceSyncFile: () => unsupportedPhase1("sync.forceSyncFile"),
	getAccess: async () => null,
	getKeyTrustIssues: async () => [],
	getConflicts: () => unsupportedPhase1("sync.getConflicts"),
	getNoteMetadata: () => unsupportedPhase1("sync.getNoteMetadata"),
	getVersionHistory: () => unsupportedPhase1("sync.getVersionHistory"),
	listDeletedFiles: () => unsupportedPhase1("sync.listDeletedFiles"),
	onAccessChanged: () => noopUnsubscribe,
	onConflict: () => noopUnsubscribe,
	onFileEvent: () => noopUnsubscribe,
	onInitialSyncComplete: () => noopUnsubscribe,
	onInitialSyncProgress: () => noopUnsubscribe,
	onKeyTrustIssue: () => noopUnsubscribe,
	onStateChanged: () => noopUnsubscribe,
	onSyncLog: () => noopUnsubscribe,
	onVaultAccessDenied: () => noopUnsubscribe,
	onVekRequired: () => noopUnsubscribe,
	requestVaultKey: () => unsupportedPhase1("sync.requestVaultKey"),
	resolveConflict: () => unsupportedPhase1("sync.resolveConflict"),
	restoreDeletedFile: () => unsupportedPhase1("sync.restoreDeletedFile"),
	restoreVersion: () => unsupportedPhase1("sync.restoreVersion"),
	start: () => unsupportedPhase1("sync.start"),
	stop: () => unsupportedPhase1("sync.stop"),
	trustMemberKey: () => unsupportedPhase1("sync.trustMemberKey"),
	unlockVaultKey: () => unsupportedPhase1("sync.unlockVaultKey"),
	updateSyncPreferences: async () => {},
} satisfies Platform["sync"]
