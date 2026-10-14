export type PlanTone = "ok" | "warn" | "info" | "muted"
export type PlanAction = "billing" | "reload" | null

export interface PlanCopy {
	pill: string
	tone: PlanTone
	title: string
	body: string
	cta: string
	action: PlanAction
}

export type PlanStateId =
	| "active"
	| "cancelled"
	| "pending"
	| "expired"
	| "none"
	| "disabled"
	| "unavailable"

export const accountCopy = {
	seoTitle: "Account",
	seoDescription: "Your Cortex plan, synced vaults and signed-in devices.",
	title: "Account",
	logOut: "Log out",
	loggingOut: "Logging out",
	redirecting: "Taking you to sign in",
	planLabel: "Plan",
	vaultsTitle: "Synced vaults",
	devicesTitle: "Devices",
	devicesCount: (count: number) => `${count} signed in`,
	emptyVaultsTitle: "No synced vaults yet",
	emptyVaultsBody:
		"In Cortex, open Settings → Sync and link a vault. It shows up here once it syncs.",
	thisDevice: "This device",
	signedOut: "Signed out",
	signOut: "Sign out",
	cancel: "Cancel",
	signOutConfirm: "It stops syncing until someone signs in on it again.",
	signOutFailed: (name: string) => `Couldn’t sign out ${name}. Try again.`,
	allIdle: "Lost a device? Sign out everywhere, including this browser.",
	allAction: "Sign out of all devices",
	allConfirmTitle: "Sign out of every device?",
	allConfirmBody: "You’ll need your password to sign in again on each one.",
	allConfirmAction: "Sign out everywhere",
	allFailed: "Couldn’t sign out everywhere. Try again.",
	activeNow: "Active now",
	lastSeen: "Last seen",
	added: "Added",
	updated: "Updated",
	member: "member",
	members: "members",
	footer: "Cortex never sees your notes: Sync stores them end-to-end encrypted.",
	footerLink: "How Sync works",
	footerHref: "/docs/sync/overview",
	billingHref: "/billing",
} as const

export const planCopy: Record<PlanStateId, PlanCopy> = {
	active: {
		pill: "Active",
		tone: "ok",
		title: "Hosted Sync",
		body: "",
		cta: "",
		action: null,
	},
	cancelled: {
		pill: "Cancelled",
		tone: "warn",
		title: "Hosted Sync",
		body: "Your plan won’t renew. Sync keeps working until it ends, and your notes stay on your devices after that.",
		cta: "Turn on again",
		action: "billing",
	},
	pending: {
		pill: "Processing",
		tone: "info",
		title: "Hosted Sync",
		body: "This usually takes a minute. You can close this page; your plan turns on by itself.",
		cta: "Refresh",
		action: "reload",
	},
	expired: {
		pill: "Ended",
		tone: "muted",
		title: "Hosted Sync",
		body: "Your vaults stopped syncing. Everything is still on your devices as plain Markdown files.",
		cta: "Turn on hosted Sync",
		action: "billing",
	},
	none: {
		pill: "Free",
		tone: "muted",
		title: "Cortex",
		body: "Turn on hosted Sync to keep your vaults in step across your computer and phone, end-to-end encrypted.",
		cta: "Turn on hosted Sync",
		action: "billing",
	},
	disabled: {
		pill: "Self-hosted",
		tone: "muted",
		title: "Your own Sync server",
		body: "This account lives on a Sync server that doesn’t use billing.",
		cta: "",
		action: null,
	},
	unavailable: {
		pill: "Unavailable",
		tone: "warn",
		title: "Plan",
		body: "Your devices and vaults are fine. Try again in a moment.",
		cta: "Try again",
		action: "reload",
	},
}

export const planLines = {
	pending: "Confirming your payment",
	none: "Local vaults on every device",
	disabled: "No plan needed",
	unavailable: "We couldn’t load your plan",
	renews: "Renews",
	ends: "Ends",
	ended: "Ended",
} as const

export const billingCycleLabels: Record<string, string> = {
	month: "Monthly",
	monthly: "Monthly",
	year: "Yearly",
	yearly: "Yearly",
	annual: "Yearly",
}

export const vaultRoleLabels = {
	owner: "Owner",
	admin: "Admin",
	editor: "Editor",
	viewer: "Viewer",
	unknown: "",
} as const

export const deviceTypeLabels = {
	desktop: "Desktop",
	mobile: "Mobile",
	web: "Web",
} as const
