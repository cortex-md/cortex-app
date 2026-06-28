import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

const MAX_LOG_ENTRIES = 500

export type SyncLogLevel = "info" | "warn" | "error"

export interface SyncLogEntry {
	id: number
	timestamp: number
	level: SyncLogLevel
	message: string
	metadata?: Record<string, string>
}

export interface SyncLogState {
	entries: SyncLogEntry[]
	nextId: number

	log: (level: SyncLogLevel, message: string, metadata?: Record<string, string>) => void
	clear: () => void
}

export const useSyncLogStore = create<SyncLogState>()(
	devtools(
		immer((set, get) => ({
			entries: [],
			nextId: 0,

			log: (level, message, metadata) => {
				set((state) => {
					const entry: SyncLogEntry = {
						id: get().nextId,
						timestamp: Date.now(),
						level,
						message,
						metadata,
					}
					state.entries.push(entry)
					if (state.entries.length > MAX_LOG_ENTRIES) {
						state.entries = state.entries.slice(state.entries.length - MAX_LOG_ENTRIES)
					}
					state.nextId++
				})
			},

			clear: () => {
				set((state) => {
					state.entries = []
				})
			},
		})),
		{ name: "syncLogStore" },
	),
)
