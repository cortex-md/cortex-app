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

export const HOSTED_SYNC_PLAN: HostedSyncPlan = {
	name: "Hosted Sync",
	eyebrow: "Cortex Sync",
	headline: "Sync when you want it. The files stay yours.",
	body: "Hosted Cortex Sync adds encrypted blob storage to the local-first Markdown workspace. It stays optional, and the vault stays readable on disk.",
	price: "$2",
	period: "/ month",
	tagline: "Hosted sync for the workspace you already own.",
	cta: "Upgrade hosted Sync",
	selfHostingNote: "Self-hosting remains available. The paid plan is for hosted Cortex Sync.",
	purchaseNote: "Checkout opens on cortex.md. Your plan updates here as soon as you come back.",
}
