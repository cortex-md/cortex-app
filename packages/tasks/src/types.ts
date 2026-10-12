export type IsoDate = string
export type ClockTime = string

export type RepeatUnit = "day" | "week" | "month" | "year"

export interface TaskRepeat {
	unit: RepeatUnit
	interval: number
	dayOfMonth?: number
	whenDone?: boolean
}

export interface TaskReminder {
	date?: IsoDate
	time: ClockTime
}

export type TaskStatus = "open" | "done"

export interface Task {
	id: string
	path: string
	line: number
	bodyLine: number
	raw: string
	status: TaskStatus
	title: string
	due?: IsoDate
	time?: ClockTime
	reminder?: TaskReminder
	repeat?: TaskRepeat
	doneDate?: IsoDate
}

export interface TaskFields {
	status: TaskStatus
	title: string
	due?: IsoDate
	time?: ClockTime
	reminder?: TaskReminder
	repeat?: TaskRepeat
	doneDate?: IsoDate
}

export type TaskPatch = Partial<{
	status: TaskStatus
	title: string
	due: IsoDate | null
	time: ClockTime | null
	reminder: TaskReminder | null
	repeat: TaskRepeat | null
	doneDate: IsoDate | null
}>

export interface TaskRef {
	path: string
	line: number
	raw: string
}

export type ReminderPreset = "at" | "5" | "15" | "60" | "morning"

export interface QuietHours {
	enabled: boolean
	start: ClockTime
	end: ClockTime
}

export interface ReminderPlanOptions {
	remindersEnabled: boolean
	digestEnabled: boolean
	digestTime: ClockTime
	quietHours: QuietHours
	inboxPath?: string
	horizonMs?: number
}

export type ScheduledReminderKind = "task" | "digest"

export interface ScheduledReminder {
	id: string
	kind: ScheduledReminderKind
	fireAt: number
	title: string
	body: string
	task?: TaskRef
}
