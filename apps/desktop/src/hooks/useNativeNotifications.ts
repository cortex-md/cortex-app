import { noteCache, useSubscriptionStore, useSyncStore } from "@cortex/core"
import { useEffect, useRef } from "react"
import { sendCoreNotification } from "../utils/nativeNotifications"

export function useNativeNotifications() {
	const conflicts = useSyncStore((state) => state.conflicts)
	const engineState = useSyncStore((state) => state.engineState)
	const error = useSyncStore((state) => state.error)
	const initialSyncComplete = useSyncStore((state) => state.initialSyncComplete)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const vekRequired = useSyncStore((state) => state.vekRequired)
	const subscriptionBlock = useSubscriptionStore((state) => state.block)

	const knownConflictPaths = useRef<Set<string> | null>(null)
	knownConflictPaths.current ??= new Set()
	const deniedReason = useRef<string | null>(null)
	const syncError = useRef<string | null>(null)
	const initialSyncWasComplete = useRef(false)
	const vekNotificationSent = useRef(false)

	useEffect(() => {
		const paths = Object.keys(conflicts)
		for (const path of paths) {
			if (knownConflictPaths.current?.has(path)) continue
			void sendCoreNotification({
				id: `sync-conflict:${path}`,
				tag: `sync-conflict:${path}`,
				title: "Sync conflict detected",
				body: getFileName(path),
				kind: "warning",
				urgency: "high",
			})
		}
		knownConflictPaths.current = new Set(paths)
	}, [conflicts])

	useEffect(() => {
		if (engineState !== "denied") {
			deniedReason.current = null
			return
		}

		const reason = error ?? "Vault access was denied."
		if (deniedReason.current === reason) return
		deniedReason.current = reason
		void sendCoreNotification({
			id: subscriptionBlock ? "sync-plan-required" : "sync-access-denied",
			tag: subscriptionBlock ? "sync-plan-required" : "sync-access-denied",
			title: subscriptionBlock ? "Cortex Cloud plan required" : "Vault access denied",
			body: reason,
			kind: "error",
			urgency: "high",
		})
	}, [engineState, error, subscriptionBlock])

	useEffect(() => {
		if (!error || engineState === "denied") {
			syncError.current = null
			return
		}

		const reason = lastSyncedAt ? "Sync needs attention." : "Initial sync failed."
		const key = `${reason}:${error}`
		if (syncError.current === key) return
		syncError.current = key
		void sendCoreNotification({
			id: `sync-error:${hashText(key)}`,
			tag: "sync-error",
			title: reason,
			body: error,
			kind: "error",
			urgency: "high",
		})
	}, [engineState, error, lastSyncedAt])

	useEffect(() => {
		if (!initialSyncComplete) {
			initialSyncWasComplete.current = false
			return
		}
		if (initialSyncWasComplete.current) return
		initialSyncWasComplete.current = true
		void sendCoreNotification({
			id: "initial-sync-complete",
			tag: "initial-sync",
			title: "Initial sync complete",
			body: "Your vault is up to date.",
			kind: "success",
			urgency: "normal",
		})
	}, [initialSyncComplete])

	useEffect(() => {
		if (!vekRequired) {
			vekNotificationSent.current = false
			return
		}
		if (vekNotificationSent.current) return
		vekNotificationSent.current = true
		void sendCoreNotification({
			id: "vault-encryption-key-required",
			tag: "vault-encryption-key-required",
			title: "Vault key required",
			body: "Unlock your vault key to continue syncing.",
			kind: "warning",
			urgency: "high",
		})
	}, [vekRequired])

	useEffect(() => {
		return noteCache.onExternalChange((event) => {
			if (event.kind !== "conflict") return
			void sendCoreNotification({
				id: `external-file-conflict:${event.filePath}`,
				tag: `external-file-conflict:${event.filePath}`,
				title: "External file conflict",
				body: getFileName(event.filePath),
				kind: "warning",
				urgency: "high",
			})
		})
	}, [])
}

function getFileName(path: string): string {
	return path.split("/").filter(Boolean).at(-1) ?? path
}

function hashText(value: string): string {
	let hash = 0
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0
	}
	return Math.abs(hash).toString(36)
}
