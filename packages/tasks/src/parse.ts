import { isClockTime, isIsoDate } from "./dates"
import { formatRepeat, parseRepeat } from "./recurrence"
import type { Task, TaskFields, TaskPatch, TaskRef, TaskReminder } from "./types"

const TASK_LINE_PATTERN =
	/^((?:[ \t]*>[ \t]?)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[([ xX])\](?:[ \t]+(.*))?$/
const OPENING_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const FRONTMATTER_CLOSING_PATTERN = /^(?:---|\.\.\.)\s*$/
const BLOCK_ID_PATTERN = /(\s+\^[A-Za-z0-9-]+)\s*$/
const DUE_TOKEN = /📅️?\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/u
const REMINDER_TOKEN = /⏰️?\s*(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{2}:\d{2})/u
const REPEAT_TOKEN =
	/🔁️?\s*((?:every\s+(?:\d+\s+)?(?:day|week|month|year)s?(?:\s+on\s+the\s+\d{1,2}(?:st|nd|rd|th)?)?|daily|weekly|monthly|yearly)(?:\s+when\s+done)?)(?![\p{L}\p{N}])/iu
const DONE_TOKEN = /✅️?\s*(\d{4}-\d{2}-\d{2})/u

type TokenKind = "due" | "reminder" | "repeat" | "done"

const TOKEN_ORDER: readonly TokenKind[] = ["due", "reminder", "repeat", "done"]

interface TokenSpan {
	start: number
	end: number
}

interface ParsedTaskLine {
	prefix: string
	marker: string
	text: string
	blockId: string
	spans: Partial<Record<TokenKind, TokenSpan>>
	fields: TaskFields
}

function maskSpan(masked: string, span: TokenSpan): string {
	return `${masked.slice(0, span.start)}${" ".repeat(span.end - span.start)}${masked.slice(span.end)}`
}

function parseTaskLineParts(line: string): ParsedTaskLine | null {
	const lineMatch = TASK_LINE_PATTERN.exec(line)
	if (!lineMatch) return null
	const body = lineMatch[3] ?? ""
	const blockMatch = BLOCK_ID_PATTERN.exec(body)
	const text = blockMatch ? body.slice(0, blockMatch.index) : body
	const marker = lineMatch[2] ?? " "
	const fields: TaskFields = { status: marker === " " ? "open" : "done", title: "" }
	const spans: ParsedTaskLine["spans"] = {}
	let masked = text

	const take = (kind: TokenKind, match: RegExpExecArray) => {
		const span = { start: match.index, end: match.index + match[0].length }
		spans[kind] = span
		masked = maskSpan(masked, span)
	}

	const dueMatch = DUE_TOKEN.exec(masked)
	if (dueMatch?.[1] && isIsoDate(dueMatch[1]) && (!dueMatch[2] || isClockTime(dueMatch[2]))) {
		fields.due = dueMatch[1]
		if (dueMatch[2]) fields.time = dueMatch[2]
		take("due", dueMatch)
	}

	const reminderMatch = REMINDER_TOKEN.exec(masked)
	if (
		reminderMatch?.[2] &&
		isClockTime(reminderMatch[2]) &&
		(!reminderMatch[1] || isIsoDate(reminderMatch[1]))
	) {
		const reminder: TaskReminder = { time: reminderMatch[2] }
		if (reminderMatch[1] && reminderMatch[1] !== fields.due) reminder.date = reminderMatch[1]
		fields.reminder = reminder
		take("reminder", reminderMatch)
	}

	const repeatMatch = REPEAT_TOKEN.exec(masked)
	const repeat = repeatMatch?.[1] ? parseRepeat(repeatMatch[1]) : undefined
	if (repeatMatch && repeat) {
		fields.repeat = repeat
		take("repeat", repeatMatch)
	}

	const doneMatch = DONE_TOKEN.exec(masked)
	if (doneMatch?.[1] && isIsoDate(doneMatch[1])) {
		fields.doneDate = doneMatch[1]
		take("done", doneMatch)
	}

	fields.title = masked.replace(/\s+/g, " ").trim()
	return {
		prefix: lineMatch[1] ?? "",
		marker,
		text,
		blockId: blockMatch?.[1] ?? "",
		spans,
		fields,
	}
}

export function parseTaskLine(line: string): TaskFields | null {
	return parseTaskLineParts(line)?.fields ?? null
}

export function isTaskLine(line: string): boolean {
	return TASK_LINE_PATTERN.test(line)
}

function hashText(text: string): string {
	let hash = 0x811c9dc5
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index)
		hash = Math.imul(hash, 0x01000193)
	}
	return (hash >>> 0).toString(36)
}

function skipFrontmatter(lines: readonly string[]): number {
	if (lines[0] !== "---") return 0
	for (let index = 1; index < lines.length; index++) {
		if (FRONTMATTER_CLOSING_PATTERN.test(lines[index] ?? "")) return index + 1
	}
	return 0
}

interface OpenFence {
	char: string
	length: number
}

function readFence(line: string): OpenFence | null {
	const match = OPENING_FENCE_PATTERN.exec(line)
	const fence = match?.[1]
	if (!fence) return null
	const char = fence.charAt(0)
	if (char === "`" && match[2]?.includes("`")) return null
	return { char, length: fence.length }
}

function closesFence(line: string, fence: OpenFence): boolean {
	const match = OPENING_FENCE_PATTERN.exec(line)
	const candidate = match?.[1]
	return (
		candidate !== undefined &&
		candidate.charAt(0) === fence.char &&
		candidate.length >= fence.length &&
		!match?.[2]?.trim()
	)
}

function forEachTaskLine(
	lines: readonly string[],
	visit: (line: string, index: number, parsed: ParsedTaskLine, bodyStart: number) => void,
): void {
	const bodyStart = skipFrontmatter(lines)
	let fence: OpenFence | null = null
	for (let index = bodyStart; index < lines.length; index++) {
		const line = lines[index] ?? ""
		if (fence) {
			if (closesFence(line, fence)) fence = null
			continue
		}
		fence = readFence(line)
		if (fence || !line.includes("[")) continue
		const parsed = parseTaskLineParts(line)
		if (parsed?.fields.title) visit(line, index, parsed, bodyStart)
	}
}

export function parseTasks(path: string, content: string): Task[] {
	if (!content.includes("[")) return []
	const tasks: Task[] = []
	const occurrences = new Map<string, number>()
	forEachTaskLine(content.split(/\r?\n/), (line, index, parsed, bodyStart) => {
		const titleHash = hashText(parsed.fields.title)
		const occurrence = occurrences.get(titleHash) ?? 0
		occurrences.set(titleHash, occurrence + 1)
		tasks.push({
			...parsed.fields,
			id: `${path}::${titleHash}::${occurrence}`,
			path,
			line: index,
			bodyLine: index - bodyStart,
			raw: line,
		})
	})
	return tasks
}

export function getTaskIdPath(id: string): string {
	const occurrenceSeparator = id.lastIndexOf("::")
	if (occurrenceSeparator <= 0) return id
	const hashSeparator = id.lastIndexOf("::", occurrenceSeparator - 1)
	return hashSeparator < 0 ? id : id.slice(0, hashSeparator)
}

function formatToken(kind: TokenKind, fields: TaskFields): string | null {
	switch (kind) {
		case "due":
			if (!fields.due) return null
			return fields.time ? `📅 ${fields.due} ${fields.time}` : `📅 ${fields.due}`
		case "reminder": {
			if (!fields.reminder) return null
			const date =
				fields.reminder.date && fields.reminder.date !== fields.due
					? `${fields.reminder.date} `
					: ""
			return `⏰ ${date}${fields.reminder.time}`
		}
		case "repeat":
			return fields.repeat ? `🔁 ${formatRepeat(fields.repeat)}` : null
		case "done":
			return fields.status === "done" && fields.doneDate ? `✅ ${fields.doneDate}` : null
	}
}

function formatTaskText(fields: TaskFields): string {
	const parts = fields.title ? [fields.title] : []
	for (const kind of TOKEN_ORDER) {
		const token = formatToken(kind, fields)
		if (token) parts.push(token)
	}
	return parts.join(" ")
}

export function serializeTaskFields(prefix: string, fields: TaskFields): string {
	const checkbox = `${prefix}[${fields.status === "done" ? "x" : " "}]`
	const text = formatTaskText(fields)
	return text ? `${checkbox} ${text}` : checkbox
}

export function createTaskLine(fields: TaskFields): string {
	return serializeTaskFields("- ", fields)
}

function applyPatchToFields(fields: TaskFields, patch: TaskPatch): TaskFields {
	const next: TaskFields = { ...fields }
	for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
		const value = patch[key]
		if (value === null) {
			delete next[key as Exclude<keyof TaskFields, "status" | "title">]
		} else if (value !== undefined) {
			Object.assign(next, { [key]: value })
		}
	}
	if (!next.due) delete next.time
	if (next.reminder && !next.reminder.date && !next.due) delete next.reminder
	return next
}

function removeSpan(text: string, span: TokenSpan): string {
	let { start, end } = span
	while (start > 0 && /[ \t]/.test(text.charAt(start - 1))) start--
	if (start === 0) while (end < text.length && /[ \t]/.test(text.charAt(end))) end++
	return `${text.slice(0, start)}${text.slice(end)}`
}

function rewriteTaskText(parsed: ParsedTaskLine, next: TaskFields): string {
	if (next.title !== parsed.fields.title) return formatTaskText(next)
	let text = parsed.text
	const appended: string[] = []
	const edits = TOKEN_ORDER.flatMap((kind) => {
		const previousToken = formatToken(kind, parsed.fields)
		const nextToken = formatToken(kind, next)
		const span = parsed.spans[kind]
		if (previousToken === nextToken && (span || !nextToken)) return []
		if (!span) {
			if (nextToken) appended.push(nextToken)
			return []
		}
		return [{ span, token: nextToken }]
	}).sort((left, right) => right.span.start - left.span.start)
	for (const { span, token } of edits) {
		text = token
			? `${text.slice(0, span.start)}${token}${text.slice(span.end)}`
			: removeSpan(text, span)
	}
	if (appended.length === 0) return text
	const base = text.trimEnd()
	return base ? `${base} ${appended.join(" ")}` : appended.join(" ")
}

export function applyTaskPatch(line: string, patch: TaskPatch): string {
	const parsed = parseTaskLineParts(line)
	if (!parsed) return line
	const next = applyPatchToFields(parsed.fields, patch)
	const marker =
		next.status === parsed.fields.status ? parsed.marker : next.status === "done" ? "x" : " "
	const body = `${rewriteTaskText(parsed, next)}${parsed.blockId}`
	return body ? `${parsed.prefix}[${marker}] ${body}` : `${parsed.prefix}[${marker}]`
}

export function locateTaskLine(lines: readonly string[], ref: TaskRef): number {
	if (lines[ref.line] === ref.raw && isTaskLine(ref.raw)) return ref.line
	const title = parseTaskLine(ref.raw)?.title
	let exactIndex = -1
	let exactDistance = Number.POSITIVE_INFINITY
	let titleIndex = -1
	let titleDistance = Number.POSITIVE_INFINITY
	forEachTaskLine(lines, (line, index, parsed) => {
		const distance = Math.abs(index - ref.line)
		if (line === ref.raw) {
			if (distance < exactDistance) {
				exactDistance = distance
				exactIndex = index
			}
		} else if (title !== undefined && parsed.fields.title === title && distance < titleDistance) {
			titleDistance = distance
			titleIndex = index
		}
	})
	return exactIndex >= 0 ? exactIndex : titleIndex
}

export function taskRefAtOffset(path: string, content: string, offset: number): TaskRef | null {
	if (offset < 0 || offset > content.length) return null
	const start = content.lastIndexOf("\n", offset - 1) + 1
	const newline = content.indexOf("\n", offset)
	const raw = content.slice(start, newline < 0 ? content.length : newline).replace(/\r$/, "")
	if (!isTaskLine(raw)) return null
	return { path, line: content.slice(0, start).split("\n").length - 1, raw }
}
