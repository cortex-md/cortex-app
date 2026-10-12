import type { SyncDb } from "./db"

const LAST_EVENT_ID = "lastEventId"

function eventNumber(eventId: string): number {
	const parsed = Number(eventId)
	if (!Number.isSafeInteger(parsed)) throw new Error(`Event ID is not numeric: ${eventId}`)
	return parsed
}

export class EventCursor {
	private current: string | null
	private readonly processed = new Set<number>()

	constructor(private readonly db: SyncDb) {
		this.current = db.getMeta(LAST_EVENT_ID)
	}

	get value(): string | null {
		return this.current
	}

	reset(eventId: string | null): void {
		this.processed.clear()
		if (!eventId) return
		this.current = eventId
		this.db.setMeta(LAST_EVENT_ID, eventId)
	}

	markProcessed(eventId: string): void {
		const processedId = eventNumber(eventId)
		const currentId = this.current ? eventNumber(this.current) : 0
		if (processedId <= currentId) return
		this.processed.add(processedId)

		const blocking = this.db.firstQueuedEventAfter(currentId) ?? Number.POSITIVE_INFINITY
		let next = currentId
		for (const candidate of this.processed) {
			if (candidate < blocking && candidate > next) next = candidate
		}
		if (next === currentId) return

		this.current = String(next)
		this.db.setMeta(LAST_EVENT_ID, this.current)
		for (const id of this.processed) {
			if (id <= next) this.processed.delete(id)
		}
	}
}
