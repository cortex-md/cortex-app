export const billingCopy = {
	seoTitle: "Billing",
	seoDescription: "Start a hosted Cortex Sync checkout. Self-hosting stays available.",
	checking: {
		title: "Opening checkout",
		body: "Cortex is creating your checkout.",
	},
	authenticating: {
		title: "Taking you to sign in",
		body: "Sign in or create an account, then Cortex will continue to checkout.",
	},
	account: {
		title: "Opening your account",
		body: "Your hosted Sync plan is already active.",
	},
	redirecting: {
		title: "Redirecting to checkout",
		body: "If the checkout does not open automatically, continue manually.",
		cta: "Continue to Stripe",
	},
	error: {
		title: "Checkout is temporarily unavailable",
		fallback: "Cortex Sync could not create a checkout. Try again in a moment.",
		cta: "Try again",
	},
} as const

export const billingCancelledCopy = {
	seoTitle: "Checkout cancelled",
	seoDescription: "Your Cortex Sync checkout was cancelled and your plan was not changed.",
	title: "Checkout was cancelled.",
	body: "Your plan was not changed. You can restart checkout when you are ready, or return to pricing.",
	retry: "Try checkout again",
	retryHref: "/billing",
	back: "Back to pricing",
	backHref: "/#pricing",
} as const

export const billingSuccessCopy = {
	seoTitle: "Hosted Sync is on",
	seoDescription: "Your hosted Cortex Sync plan is active.",
	title: "Hosted Sync is on",
	body: "Payment confirmed. Finish in the app:",
	steps: [
		"Open Cortex on this computer",
		"Settings → Sync → Link vault",
		"Sign in on your other devices",
	],
	cta: "Open Cortex",
	receipt: (email: string | null) =>
		email ? `A receipt is on its way to ${email}.` : "A receipt is on its way to your email.",
} as const

export const inviteCopy = {
	seoTitle: "Vault invite",
	seoDescription: "Join a shared Cortex vault.",
	pendingTitle: (inviter: string) =>
		inviter ? `${inviter} invited you to a vault` : "You’re invited to a vault",
	joinAs: (role: string) => (role ? `You’ll join as ${role}` : "You’ll join this vault"),
	accept: "Accept invite",
	accepting: "Joining",
	decline: "Decline",
	expires: (date: string) => `Invite expires ${date}.`,
	signedInAs: (email: string) => `Signed in as ${email}`,
	switchAccount: "Switch",
	acceptedTitle: (vault: string) => `You joined ${vault}`,
	acceptedBody: "Open it in Cortex to start syncing. Notes download to a folder you choose.",
	openInCortex: "Open in Cortex",
	download: "Download Cortex",
	downloadHref: "/#download",
	declinedTitle: "Invite declined",
	declinedBody:
		"Nothing was changed. This link keeps working until it expires if you change your mind.",
	undo: "Undo",
	expiredTitle: "This invite has expired",
	expiredBody: "Invites only work for a short time. Ask the person who invited you for a new link.",
	expiredCta: "Go to your account",
	unavailableTitle: "We couldn’t open this invite",
	retry: "Try again",
	redirecting: "Taking you to sign in",
	roles: {
		owner: "Owner",
		admin: "Admin",
		editor: "Editor",
		viewer: "Viewer",
		unknown: "",
	},
} as const
