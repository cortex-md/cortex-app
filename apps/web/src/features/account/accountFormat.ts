import type { SubscriptionStatus } from "@cortex/sync-api"
import {
	billingCycleLabels,
	type deviceTypeLabels,
	type PlanStateId,
	planLines,
} from "../../content/account"

const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

const dateFormatter = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
})
const shortDateFormatter = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
})
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

function parseDate(value: string | null | undefined) {
	if (!value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | null | undefined) {
	const date = parseDate(value)
	return date ? dateFormatter.format(date) : null
}

export function formatRelative(value: string | null | undefined, now = Date.now()) {
	const date = parseDate(value)
	if (!date) return null

	const elapsed = now - date.getTime()
	if (elapsed < hour)
		return relativeFormatter.format(-Math.max(1, Math.round(elapsed / minute)), "minute")
	if (elapsed < day) return relativeFormatter.format(-Math.round(elapsed / hour), "hour")
	if (elapsed < 7 * day) return relativeFormatter.format(-Math.round(elapsed / day), "day")

	const sameYear = date.getUTCFullYear() === new Date(now).getUTCFullYear()
	return sameYear ? shortDateFormatter.format(date) : dateFormatter.format(date)
}

export function formatRelativeDay(value: string | null | undefined, now = Date.now()) {
	const date = parseDate(value)
	if (!date) return null

	const startOfToday = Date.UTC(
		new Date(now).getUTCFullYear(),
		new Date(now).getUTCMonth(),
		new Date(now).getUTCDate(),
	)
	const startOfDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	const days = Math.round((startOfToday - startOfDate) / day)

	if (days >= 0 && days < 7) return relativeFormatter.format(-days, "day")
	const sameYear = date.getUTCFullYear() === new Date(now).getUTCFullYear()
	return sameYear ? shortDateFormatter.format(date) : dateFormatter.format(date)
}

export function isActiveNow(value: string | null | undefined, now = Date.now()) {
	const date = parseDate(value)
	return date !== null && now - date.getTime() < 5 * minute
}

export function formatBillingCycle(value: string | null) {
	if (!value) return null
	return billingCycleLabels[value.trim().toLowerCase()] ?? null
}

export function getDeviceKind(type: string): keyof typeof deviceTypeLabels {
	const value = type.toLowerCase()
	if (["mobile", "ios", "android", "phone", "tablet", "ipad", "iphone"].includes(value))
		return "mobile"
	if (["web", "browser"].includes(value)) return "web"
	return "desktop"
}

export function resolvePlanState(status: SubscriptionStatus): PlanStateId {
	switch (status.status) {
		case "disabled":
			return "disabled"
		case "active":
			return status.entitled ? "active" : "expired"
		case "cancelled":
			return status.entitled ? "cancelled" : "expired"
		case "pending":
			return "pending"
		case "expired":
			return "expired"
		case "unknown":
			return status.entitled ? "active" : "none"
		default:
			return status.entitled ? "active" : "none"
	}
}

function joinParts(parts: Array<string | null>) {
	return parts.filter(Boolean).join(" · ")
}

export function getPlanLine(state: PlanStateId, status: SubscriptionStatus | null) {
	if (!status) return planLines.unavailable

	const cycle = formatBillingCycle(status.billingCycle)
	const endDate = formatDate(status.entitlementExpiresAt ?? status.currentPeriodEnd)

	switch (state) {
		case "active": {
			const renews = formatDate(status.currentPeriodEnd)
			return joinParts([cycle, renews ? `${planLines.renews} ${renews}` : null])
		}
		case "cancelled":
			return joinParts([cycle, endDate ? `${planLines.ends} ${endDate}` : null])
		case "expired":
			return endDate ? `${planLines.ended} ${endDate}` : planLines.ended
		case "pending":
			return planLines.pending
		case "disabled":
			return planLines.disabled
		case "unavailable":
			return planLines.unavailable
		default:
			return planLines.none
	}
}
