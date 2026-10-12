import { getPlatform, type VaultMetadata, type WindowMessage } from "@cortex/platform"

export type WindowRole = "main" | "settings"

type Slice = Record<string, unknown>

interface MirrorableStore<S> {
	getState(): S
	setState(partial: Partial<S>): void
	subscribe(listener: (state: S, previous: S) => void): () => void
}

export interface MirroredStore {
	name: string
	from: "main" | "both"
	pick(): Slice
	subscribe(listener: (changes: Slice) => void): () => void
	apply(slice: Slice): void
}

export interface WindowSnapshot {
	vault: VaultMetadata | null
	slices: Record<string, Slice>
}

interface MirrorOptions<S, K extends keyof S> {
	from?: MirroredStore["from"]
	apply?: (slice: Pick<S, K>) => void
}

export function mirrorStore<S, K extends keyof S & string>(
	name: string,
	store: MirrorableStore<S>,
	keys: readonly K[],
	options: MirrorOptions<S, K> = {},
): MirroredStore {
	const pickFrom = (state: S) =>
		Object.fromEntries(keys.map((key) => [key, state[key]])) as Pick<S, K>
	return {
		name,
		from: options.from ?? "both",
		pick: () => pickFrom(store.getState()),
		subscribe: (listener) =>
			store.subscribe((state, previous) => {
				const changed = keys.filter((key) => state[key] !== previous[key])
				if (changed.length > 0) {
					listener(Object.fromEntries(changed.map((key) => [key, state[key]])))
				}
			}),
		apply: (slice) => {
			if (options.apply) options.apply({ ...pickFrom(store.getState()), ...slice } as Pick<S, K>)
			else store.setState(slice as Partial<S>)
		},
	}
}

let applyingRemote = false

function applyRemote(mirror: MirroredStore, slice: Slice): void {
	applyingRemote = true
	try {
		mirror.apply(slice)
	} finally {
		applyingRemote = false
	}
}

function send(message: WindowMessage): void {
	void getPlatform()
		.window.relay(message)
		.catch((error: unknown) => console.error("[window-bridge] relay failed:", message.type, error))
}

export function applySnapshotSlices(mirrors: readonly MirroredStore[], snapshot: WindowSnapshot) {
	for (const mirror of mirrors) {
		const slice = snapshot.slices[mirror.name]
		if (slice) applyRemote(mirror, slice)
	}
}

interface WindowBridgeOptions {
	role: WindowRole
	mirrors: readonly MirroredStore[]
	getVault?: () => VaultMetadata | null
	onSnapshot?: (snapshot: WindowSnapshot) => void
	onNavigate?: (section: string, fieldId?: string) => void
	actions?: Record<string, (payload: never) => unknown>
}

export interface WindowBridge {
	publishSnapshot(): void
	requestSnapshot(): void
	pauseRelay<T>(run: () => Promise<T>): Promise<T>
	dispose(): void
}

export function startWindowBridge(options: WindowBridgeOptions): WindowBridge {
	const { role, mirrors } = options
	const byName = new Map(mirrors.map((mirror) => [mirror.name, mirror]))
	let paused = 0

	const takeSnapshot = (): WindowSnapshot => ({
		vault: options.getVault?.() ?? null,
		slices: Object.fromEntries(mirrors.map((mirror) => [mirror.name, mirror.pick()])),
	})

	const unsubscribes = mirrors
		.filter((mirror) => mirror.from === "both" || role === "main")
		.map((mirror) =>
			mirror.subscribe((slice) => {
				if (applyingRemote || paused > 0) return
				send({ type: "store", name: mirror.name, slice })
			}),
		)

	const unlisten = getPlatform().window.onMessage((message) => {
		switch (message.type) {
			case "store": {
				const mirror = byName.get(String(message.name))
				if (mirror && (mirror.from === "both" || role === "settings")) {
					applyRemote(mirror, message.slice as Slice)
				}
				return
			}
			case "snapshot-request":
				if (role === "main") send({ type: "snapshot", snapshot: takeSnapshot() })
				return
			case "snapshot":
				if (role === "settings") options.onSnapshot?.(message.snapshot as WindowSnapshot)
				return
			case "navigate":
				options.onNavigate?.(
					String(message.section),
					typeof message.fieldId === "string" ? message.fieldId : undefined,
				)
				return
			case "action": {
				const action = options.actions?.[String(message.name)]
				if (!action) return
				Promise.resolve(action(message.payload as never)).catch((error: unknown) =>
					console.error("[window-bridge] action failed:", message.name, error),
				)
				return
			}
		}
	})

	return {
		publishSnapshot: () => send({ type: "snapshot", snapshot: takeSnapshot() }),
		requestSnapshot: () => send({ type: "snapshot-request" }),
		pauseRelay: async (run) => {
			paused += 1
			try {
				return await run()
			} finally {
				paused -= 1
			}
		},
		dispose: () => {
			unlisten()
			for (const unsubscribe of unsubscribes) unsubscribe()
		},
	}
}

export function sendWindowAction(name: string, payload?: unknown): void {
	send({ type: "action", name, payload })
}
