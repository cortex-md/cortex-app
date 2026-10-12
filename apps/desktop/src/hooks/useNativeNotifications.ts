import {
	getBaseName,
	noteCache,
	type SyncState,
	useSubscriptionStore,
	useSyncStore,
} from "@cortex/core"
import { useEffect } from "react"
import { sendCoreNotification } from "../utils/nativeNotifications"

function hashText(value: string): string {
	let hash = 0
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0
	}
	return Math.abs(hash).toString(36)
}

function startNativeNotifications(): () => void {
	let knownConflictPaths = new Set<string>()
	let deniedReason: string | null = null
	let syncErrorKey: string | null = null
	let initialSyncWasComplete = false
	let vekNotificationSent = false

	const notifyConflicts = (conflicts: SyncState["conflicts"]) => {
		const paths = Object.keys(conflicts)
		for (const path of paths) {
			if (knownConflictPaths.has(path)) continue
			void sendCoreNotification({
				id: `sync-conflict:${path}`,
				tag: `sync-conflict:${path}`,
				title: "Sync conflict detected",
				body: getBaseName(path),
				kind: "warning",
				urgency: "high",
			})
		}
		knownConflictPaths = new Set(paths)
	}

	const notifyAccessDenied = (state: SyncState) => {
		if (state.engineState !== "denied") {
			deniedReason = null
			return
		}
		const reason = state.error ?? "Vault access was denied."
		if (deniedReason === reason) return
		deniedReason = reason
		const planRequired = useSubscriptionStore.getState().block !== null
		void sendCoreNotification({
			id: planRequired ? "sync-plan-required" : "sync-access-denied",
			tag: planRequired ? "sync-plan-required" : "sync-access-denied",
			title: planRequired ? "Cortex Cloud plan required" : "Vault access denied",
			body: reason,
			kind: "error",
			urgency: "high",
		})
	}

	const notifySyncError = (state: SyncState) => {
		if (!state.error || state.engineState === "denied") {
			syncErrorKey = null
			return
		}
		const reason = state.lastSyncedAt ? "Sync needs attention." : "Initial sync failed."
		const key = `${reason}:${state.error}`
		if (syncErrorKey === key) return
		syncErrorKey = key
		void sendCoreNotification({
			id: `sync-error:${hashText(key)}`,
			tag: "sync-error",
			title: reason,
			body: state.error,
			kind: "error",
			urgency: "high",
		})
	}

	const notifyInitialSync = (initialSyncComplete: boolean) => {
		if (!initialSyncComplete) {
			initialSyncWasComplete = false
			return
		}
		if (initialSyncWasComplete) return
		initialSyncWasComplete = true
		void sendCoreNotification({
			id: "initial-sync-complete",
			tag: "initial-sync",
			title: "Initial sync complete",
			body: "Your vault is up to date.",
			kind: "success",
			urgency: "normal",
		})
	}

	const notifyVekRequired = (vekRequired: boolean) => {
		if (!vekRequired) {
			vekNotificationSent = false
			return
		}
		if (vekNotificationSent) return
		vekNotificationSent = true
		void sendCoreNotification({
			id: "vault-encryption-key-required",
			tag: "vault-encryption-key-required",
			title: "Waiting for vault access",
			body: "Sync starts as soon as a vault admin grants you access.",
			kind: "warning",
			urgency: "high",
		})
	}

	const handleSyncState = (state: SyncState, previousState?: SyncState) => {
		if (state.conflicts !== previousState?.conflicts) notifyConflicts(state.conflicts)
		if (state.engineState !== previousState?.engineState || state.error !== previousState.error) {
			notifyAccessDenied(state)
		}
		if (
			state.engineState !== previousState?.engineState ||
			state.error !== previousState.error ||
			state.lastSyncedAt !== previousState.lastSyncedAt
		) {
			notifySyncError(state)
		}
		if (state.initialSyncComplete !== previousState?.initialSyncComplete) {
			notifyInitialSync(state.initialSyncComplete)
		}
		if (state.vekRequired !== previousState?.vekRequired) notifyVekRequired(state.vekRequired)
	}

	handleSyncState(useSyncStore.getState())
	const unsubscribeSync = useSyncStore.subscribe(handleSyncState)
	const unsubscribeSubscription = useSubscriptionStore.subscribe((state, previousState) => {
		if (state.block !== previousState.block) notifyAccessDenied(useSyncStore.getState())
	})
	const unsubscribeExternalChanges = noteCache.onExternalChange((event) => {
		if (event.kind !== "conflict") return
		void sendCoreNotification({
			id: `external-file-conflict:${event.filePath}`,
			tag: `external-file-conflict:${event.filePath}`,
			title: "External file conflict",
			body: getBaseName(event.filePath),
			kind: "warning",
			urgency: "high",
		})
	})

	return () => {
		unsubscribeSync()
		unsubscribeSubscription()
		unsubscribeExternalChanges()
	}
}

export function useNativeNotifications() {
	useEffect(() => startNativeNotifications(), [])
}
