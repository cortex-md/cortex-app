import {
	CLOUD_SERVER_LABEL,
	DEFAULT_CLOUD_SYNC_SERVER_URL,
	normalizeServerUrl,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSyncExternalStore } from "react"

export interface AccountServer {
	selfHosted: boolean
	url: string
}

const STORAGE_KEY = "account_server"
const REACHABILITY_TIMEOUT_MS = 5000

const listeners = new Set<() => void>()
let current: AccountServer = { selfHosted: false, url: "" }
let configured = false

function setAccountServer(server: AccountServer): void {
	current = server
	configured = true
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function getAccountServer(): AccountServer {
	return current
}

export async function selectAccountServer(server: AccountServer): Promise<void> {
	const next = { selfHosted: server.selfHosted, url: normalizeServerUrl(server.url) }
	setAccountServer(next)
	await getPlatform()
		.keychain.set(STORAGE_KEY, JSON.stringify(next))
		.catch(() => undefined)
	await alignVaultServer()
}

function parseServer(raw: string | null): AccountServer | null {
	if (!raw) return null
	try {
		const value = JSON.parse(raw) as Partial<AccountServer>
		if (typeof value.selfHosted !== "boolean" || typeof value.url !== "string") return null
		return { selfHosted: value.selfHosted, url: value.url }
	} catch {
		return null
	}
}

export function accountServerUrl(server: AccountServer): string {
	return server.selfHosted ? normalizeServerUrl(server.url) : DEFAULT_CLOUD_SYNC_SERVER_URL
}

export function describeServerHost(url: string): string {
	try {
		return new URL(url).host
	} catch {
		return url.replace(/^https?:\/\//u, "")
	}
}

export function accountServerLabel(server: AccountServer): string {
	return server.selfHosted ? describeServerHost(server.url) : CLOUD_SERVER_LABEL
}

export function useAccountServer(): AccountServer {
	return useSyncExternalStore(subscribe, getAccountServer, getAccountServer)
}

export function isValidServerUrl(url: string): boolean {
	try {
		const parsed = new URL(url.trim())
		return parsed.protocol === "http:" || parsed.protocol === "https:"
	} catch {
		return false
	}
}

export async function checkServerReachable(url: string): Promise<boolean> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS)
	try {
		const response = await fetch(`${normalizeServerUrl(url)}/ready`, {
			signal: controller.signal,
		})
		return response.ok
	} catch {
		return false
	} finally {
		clearTimeout(timer)
	}
}

function configMatches(server: AccountServer): boolean {
	const { syncConfig } = useRemoteVaultStore.getState()
	if (syncConfig.selfHosted !== server.selfHosted) return false
	return !server.selfHosted || normalizeServerUrl(syncConfig.serverUrl ?? "") === server.url
}

function alignMemoryConfig(): void {
	const server = current
	const remote = useRemoteVaultStore.getState()
	if (!configured || useVaultStore.getState().vault || remote.linkedVaultId) return
	if (configMatches(server)) return
	useRemoteVaultStore.setState({
		syncConfig: {
			...remote.syncConfig,
			selfHosted: server.selfHosted,
			serverUrl: server.selfHosted ? server.url : remote.syncConfig.serverUrl,
		},
	})
}

export async function alignVaultServer(): Promise<void> {
	const server = current
	const vaultPath = useVaultStore.getState().vault?.path ?? null
	if (!configured) return
	if (!vaultPath) {
		alignMemoryConfig()
		return
	}
	const remote = useRemoteVaultStore.getState()
	await remote.loadLink(vaultPath)
	if (useRemoteVaultStore.getState().linkedVaultId || configMatches(server)) return
	await remote.setSelfHosted(vaultPath, server.selfHosted)
	if (server.selfHosted) await remote.saveServerUrl(vaultPath, server.url)
}

export function startAccountServerSync(): () => void {
	let canceled = false
	void getPlatform()
		.keychain.get(STORAGE_KEY)
		.catch(() => null)
		.then((raw) => {
			if (canceled) return
			const stored = parseServer(raw)
			if (stored) setAccountServer(stored)
			void alignVaultServer()
		})
	const unsubscribes = [
		useVaultStore.subscribe((state, previousState) => {
			if (state.vault?.path !== previousState.vault?.path) void alignVaultServer()
		}),
		useRemoteVaultStore.subscribe((state, previousState) => {
			if (state.syncConfig !== previousState.syncConfig) alignMemoryConfig()
		}),
	]
	return () => {
		canceled = true
		for (const unsubscribe of unsubscribes) unsubscribe()
	}
}
