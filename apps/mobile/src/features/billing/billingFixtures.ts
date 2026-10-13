export interface HostedSyncPlan {
	name: string
	eyebrow: string
	headline: string
	body: string
	price: string
	period: string
	tagline: string
	cta: string
	selfHostingNote: string
	purchaseNote: string
}

export const FIXTURE_HOSTED_SYNC_PLAN: HostedSyncPlan = {
	name: "Hosted Sync",
	eyebrow: "Cortex Sync",
	headline: "Sync when you want it. The files stay yours.",
	body: "Hosted Cortex Sync adds encrypted blob storage to the local-first Markdown workspace. It stays optional, and the vault stays readable on disk.",
	price: "$2",
	period: "/ month",
	tagline: "Hosted sync for the workspace you already own.",
	cta: "Upgrade hosted Sync",
	selfHostingNote: "Self-hosting remains available. The paid plan is for hosted Cortex Sync.",
	purchaseNote: "[Purchase path on iOS: App Store in-app purchase or web checkout]",
}

export const FIXTURE_ENTITLED = true

export interface AccountSummary {
	displayName: string
	email: string
}

export const FIXTURE_ACCOUNT: AccountSummary = {
	displayName: "Ana Moreira",
	email: "ana@example.com",
}
