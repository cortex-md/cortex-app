import { create } from "zustand"
import { devtools } from "zustand/middleware"

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
		(set, get) => ({
			entries: [],
			nextId: 0,

			log: (level, message, metadata) => {
				const { entries, nextId } = get()
				const entry: SyncLogEntry = { id: nextId, timestamp: Date.now(), level, message, metadata }
				const kept = entries.length >= MAX_LOG_ENTRIES ? entries.slice(1) : entries
				set({ entries: [...kept, entry], nextId: nextId + 1 })
			},

			clear: () => set({ entries: [] }),
		}),
		{ name: "syncLogStore" },
	),
)
