import { pricingPlan } from "./landing"

export interface ProductSeo {
	title: string
	description: string
	path: string
}

const syncMonthlyPrice = `${pricingPlan.price}/month`

export const syncPage = {
	seo: {
		title: "Sync",
		description:
			"The same Cortex vault on every device. Notes are encrypted on your device before they leave it, hosted for $2 a month or on your own server.",
		path: "/sync",
	},
	hero: {
		title: "The same vault",
		quiet: "on every device.",
		lead: "Write on your Mac, pick it up on your phone. Every change is encrypted before it leaves the device it was written on.",
	},
	primaryCta: { label: `Start syncing — ${syncMonthlyPrice}`, href: "#pricing" },
	secondaryCta: { label: "Self-host guide", href: "/docs/sync/overview" },
	mock: {
		vault: "Work",
		folders: ["Daily", "Projects", "Launch plan", "Meetings", "Reading", "Inbox"],
		activeFolder: "Launch plan",
		status: "Synced",
		title: "Launch plan",
		macMeta: "Projects · edited on this Mac",
		phoneMeta: "Projects · edited on MacBook",
		phoneBack: "‹ Projects",
		paragraphs: [
			"Ship the beta to the first hundred readers, then collect notes for a week.",
			"Invite list goes out Monday.",
		],
		typed: "Bruno sends the announcement.",
		tasks: [
			{ label: "Book the venue", done: true },
			{ label: "Final copy for the landing page", done: true },
			{ label: "Send beta invites", done: false },
		],
		phoneTabs: ["Files", "Today", "Bookmarks", "Search"],
		phoneAlt:
			"A Mac and an iPhone showing the same note. A line typed on the Mac travels as an encrypted packet and appears on the phone.",
	},
	encryption: {
		title: "Readable on your devices.",
		quiet: "Noise everywhere else.",
		body: "Each note is encrypted on your device with a key only your vault members hold. The server stores and passes along text it can’t read.",
		note: "Invite list goes out Monday. Bruno sends the announcement.",
		nodes: [
			{ label: "Your Mac", caption: "Plain text, on your disk" },
			{ label: "Cortex Sync", caption: "Encrypted, the server can’t read it" },
			{ label: "Your iPhone", caption: "Decrypted on the device" },
		],
	},
	members: {
		title: "One vault, every device and everyone on it.",
		body: "Your Mac, your phone and the people you invite share the same vault. Owners, editors and viewers each get the access they need, and you can see who is in a note right now.",
		points: [
			"Members and invites with roles",
			"Live cursors when you write together",
			"Devices listed with their last sync",
		],
		vault: "Work",
		vaultStatus: "Synced",
		satellites: [
			{ initials: "AM", name: "Ana · MacBook", detail: "Owner · now", angle: -150 },
			{ initials: "AM", name: "Ana · iPhone", detail: "Owner · now", angle: -30 },
			{ initials: "BK", name: "Bruno · iPhone", detail: "Editor · 2 min ago", angle: 40 },
			{ initials: "CL", name: "Carla · iPad", detail: "Editor · now", angle: 150 },
		],
		alt: "The Work vault in the middle of a ring, with the devices and members that share it around it.",
	},
	offline: {
		title: "Offline for a week? Nothing to fix.",
		body: "Keep writing on a plane or in a tunnel. When your devices meet again, Cortex merges what changed. If the same sentence changed in two places, both versions are kept side by side — never silently overwritten.",
		points: [
			"Version history and deleted notes on every device",
			"Conflict view with both versions",
			"Sync logs you can read",
		],
		laptop: {
			device: "MacBook",
			before: "Ship the beta to the first ",
			mark: "hundred",
			after: " readers.",
		},
		phone: { device: "iPhone", before: "Invite list goes out ", mark: "Monday", after: "." },
		offlineLabel: "offline",
		merging: "Back online · merging",
		mergedTitle: "Launch plan",
		mergedLabel: "merged",
		alt: "Two offline edits, one from a MacBook and one from an iPhone, merging into one note when they reconnect.",
	},
	pricing: {
		title: "Two dollars.",
		quiet: "Every device.",
		body: "Writing in Cortex is free. Sync is the only thing you pay for — or run it yourself.",
		plan: {
			name: pricingPlan.name,
			description: "Hosted, end-to-end encrypted sync for all your vaults.",
			price: pricingPlan.price,
			cadence: "per month",
			features: [
				"Sync across all your devices",
				"End-to-end encrypted on your device",
				"History and recovery everywhere",
				"Members, roles and live collaboration",
				"Self-hosting stays available",
			],
			cta: { label: "Start syncing", href: pricingPlan.ctaHref },
			fine: "Billed monthly. Your notes stay on your devices if you stop.",
			devicesLabel: "One price for",
			devices: ["Mac", "Windows", "Linux"],
			soonDevice: "iPhone and Android · soon",
		},
		sidePlans: [
			{
				name: "Self-hosted",
				price: "Free",
				cadence: "open source",
				body: "Run the sync server on your own machine or cloud. Same apps, same encryption.",
				cta: { label: "Self-host guide", href: "/docs/sync/overview" },
				plan: "self-hosted",
			},
			{
				name: "Local only",
				price: "Free",
				cadence: "forever",
				body: "No account. Turn sync on whenever you want.",
				cta: { label: "Download", href: "/#download" },
				plan: "local",
			},
		],
		fine: "Prices in US dollars. Taxes may apply depending on where you live.",
	},
} as const

export const mobilePage = {
	seo: {
		title: "Mobile",
		description:
			"Cortex for iOS and Android opens the same plain-Markdown vault, with the same editor and plugins. In development.",
		path: "/mobile",
	},
	hero: {
		title: "Your vault,",
		quiet: "in your pocket.",
		lead: "Cortex for iOS and Android opens the same plain-Markdown vault, with the same editor and the plugins you trust. It’s in development — here’s where it stands.",
	},
	status: "In development",
	followCta: { label: "Follow progress on the roadmap", href: "/roadmap" },
	mock: {
		today: "Today",
		tasks: [
			{ label: "Read the sync capacity doc", done: true },
			{ label: "Pay rent", done: false },
			{ label: "Draft the announcement", done: false },
			{ label: "Weekly review", done: false },
		],
		projectsTitle: "Projects",
		projects: ["Sync beta", "Public notes"],
		alt: "Cortex on a phone, showing today’s tasks and a list of projects.",
	},
	stories: [
		{
			title: "The same files, not a copy.",
			body: "The app opens a local vault on your phone. Notes stay Markdown, so they work with every other tool you use.",
			points: [
				"Local vaults on iPhone and Android",
				"The desktop editor, tuned for touch",
				"Plugins from the Marketplace",
			],
		},
		{
			title: "Built for each platform.",
			body: "Native navigation on iOS and Material on Android, so it feels at home on both.",
			points: [
				"Today with reminders as notifications",
				"Quick add from anywhere",
				"Databases and properties as sheets",
			],
		},
	],
	stepsTitle: "Where it stands",
	steps: [
		{ title: "Now", body: "Testing the editor and vaults on real devices." },
		{ title: "Next", body: "App Store and Google Play review, and search." },
		{ title: "Then", body: "Cortex Sync and live collaboration on mobile." },
	],
	final: {
		title: "Until then,",
		quiet: "Cortex runs on your desktop.",
		cta: { label: "Download for desktop", href: "/#download" },
	},
} as const

export const cliPage = {
	seo: {
		title: "CLI",
		description:
			"Create, develop, check, release and submit Cortex plugins and themes from one small CLI.",
		path: "/cli",
	},
	hero: {
		title: "Build plugins",
		quiet: "from your terminal.",
		lead: "Scaffold a plugin, run it against a real vault while you edit, then check, release and submit it for review.",
	},
	primaryCta: { label: "Read the CLI guide", href: "/docs/developers/cli" },
	secondaryCta: { label: "Plugin API", href: "/docs/plugins/overview" },
	terminal: {
		title: "zsh — ~/plugins/word-count",
		alt: "A terminal installing the Cortex CLI, then creating, developing, checking, releasing and submitting a plugin.",
		lines: [
			{ kind: "command", cwd: "~/plugins", text: "npm install -g @cortex.md/cli" },
			{ kind: "output", parts: [{ tone: "muted", text: "added 1 package" }] },
			{ kind: "command", cwd: "~/plugins", text: "cortex create word-count --plugin" },
			{
				kind: "output",
				parts: [
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " Created " },
					{ tone: "accent", text: "word-count/" },
				],
			},
			{ kind: "output", parts: [{ tone: "muted", text: "  ├─ manifest.json" }] },
			{ kind: "output", parts: [{ tone: "muted", text: "  ├─ src/main.ts" }] },
			{ kind: "output", parts: [{ tone: "muted", text: "  └─ .github/workflows/" }] },
			{ kind: "command", cwd: "~/plugins/word-count", text: "cortex dev --vault ~/notes" },
			{
				kind: "output",
				parts: [
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " Installed into " },
					{ tone: "accent", text: "notes/.cortex/plugins/word-count" },
				],
			},
			{ kind: "output", parts: [{ tone: "muted", text: "  ↻ rebuilt after saving src/main.ts" }] },
			{ kind: "command", cwd: "~/plugins/word-count", text: "cortex check" },
			{
				kind: "output",
				parts: [
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " manifest   " },
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " permissions: " },
					{ tone: "warn", text: "vault:read" },
					{ tone: "plain", text: "   " },
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " bundle" },
				],
			},
			{ kind: "command", cwd: "~/plugins/word-count", text: "cortex release patch" },
			{
				kind: "output",
				parts: [
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " Tagged and pushed · release workflow started" },
				],
			},
			{ kind: "command", cwd: "~/plugins/word-count", text: "cortex submit" },
			{
				kind: "output",
				parts: [
					{ tone: "ok", text: "✓" },
					{ tone: "plain", text: " Pull request opened on " },
					{ tone: "accent", text: "cortex-md/registry" },
				],
			},
		],
	},
	stories: [
		{
			title: "Develop against your own notes.",
			code: "cortex dev",
			body: " builds your plugin into a vault and rebuilds it on every change. Cortex reloads it automatically.",
			points: [
				"Commands, Markdown transforms, views and settings",
				"Typed API from @cortex.md/api",
				"Plugins and themes from the same commands",
			],
		},
		{
			title: "Ship with the same checks.",
			body: "Run the checks the Marketplace registry applies, release a version, then submit it for review before it’s listed in the Marketplace.",
			points: [
				"Manifest and permission checks",
				"Plugins declare what they can access",
				"Users turn community plugins on themselves",
			],
		},
	],
	stepsTitle: "Five commands",
	steps: [
		{
			title: "cortex create",
			body: "Start from a template with the manifest and release workflows ready.",
			mono: true,
		},
		{ title: "cortex dev", body: "Rebuild into a real vault on every change.", mono: true },
		{
			title: "cortex check · release · submit",
			body: "Run the registry checks, tag a version, then open the pull request to list it.",
			mono: true,
		},
	],
	final: {
		title: "Make Cortex",
		quiet: "do one more thing.",
		cta: { label: "Get started", href: "/docs/plugins/getting-started" },
	},
} as const

export const marketplacePage = {
	seo: {
		title: "Marketplace",
		description:
			"Plugins add commands and views, themes restyle every surface, templates start your notes. Everything installs into the vault you choose.",
		path: "/marketplace",
	},
	hero: {
		title: "Make Cortex",
		quiet: "yours.",
		lead: "Plugins add commands and views, themes restyle every surface, templates start your notes. Everything installs into the vault you choose.",
	},
	primaryCta: { label: "Browse the Marketplace", href: "/marketplace/browse" },
	secondaryCta: { label: "Download Cortex", href: "/#download" },
	window: {
		title: "Marketplace",
		search: "Search themes…",
		tabs: ["Plugins", "Themes", "Templates"],
		activeTab: "Themes",
		installedLabel: "Installed",
		communityLabel: "Community",
		inUse: "In use",
		builtIn: "Built in",
		themes: [
			{ id: "paper", name: "Paper" },
			{ id: "ink", name: "Ink" },
		],
		community: { id: "gruv", name: "Gruvbox", author: "Cortex Theme Lab" },
		description: "A warm Gruvbox theme for Cortex with dark and light variants.",
		useTheme: "Use theme",
		uninstall: "Uninstall",
		coverTitle: "Reading list",
		coverLink: "[[Autumn]]",
		info: [
			{ label: "Theme version", value: "1.1.0" },
			{ label: "Minimum Cortex", value: "0.1.0" },
			{ label: "Scope", value: "This vault" },
			{ label: "Source", value: "cortex-md/gruvbox" },
		],
		alt: "The Cortex Marketplace window on the Themes tab. Picking Gruvbox spreads its colors through the window in a circle, then Paper comes back.",
	},
	permissions: {
		title: "Plugins show what they can touch.",
		body: "Community plugins stay off until you turn them on. Before you enable one, Cortex reads its manifest and lists every permission in plain words — and they apply to this vault only.",
		points: [
			"Never enabled automatically",
			"Every permission listed before you enable",
			"If an update fails, the previous version comes back",
		],
		manifestFile: "manifest.json",
		pluginId: "smart-typography",
		pluginName: "Smart Typography",
		manifestPermissions: ["editor:read", "vault:read", "vault:write", "notifications"],
		dialogTitle: "Enable Smart Typography?",
		dialogLead: "It declares these permissions:",
		dialogWarning:
			"Community plugins run with full access to your vault and to Cortex. Only enable plugins you trust.",
		cancel: "Cancel",
		enable: "Enable",
		alt: "Smart Typography’s manifest next to the Enable dialog, which lists each declared permission in plain words.",
	},
	themes: {
		title: "Change the whole look in one click.",
		body: "Themes restyle the editor, the sidebar and every menu. Each one ships a light and a dark stylesheet, so it follows your system appearance. Not for you? Switch back the same way.",
		points: [
			"Light and dark in every theme",
			"Follows Light, Dark or System",
			"Built on stable CSS variables",
		],
		note: {
			title: "Reading list",
			meta: "Notes · edited today",
			before: "Three books for the autumn, then a short review in ",
			link: "[[Weekly review]]",
			after: ".",
			tasks: [
				{ label: "The Overstory", done: true },
				{ label: "Piranesi", done: false },
				{ label: "A Psalm for the Wild-Built", done: false },
			],
			quote: "Read slowly. Write one line after every chapter.",
		},
		labels: { paper: "Paper", gruvbox: "Gruvbox" },
		alt: "The same note in the Paper theme and the Gruvbox theme, with a handle sweeping between them.",
	},
	templates: {
		title: "One click,",
		quiet: "and the work is set up.",
		body: "A template brings more than text. Cortex fills in today’s date and the note’s name, and a database template arrives with its properties, views and first rows — from the Marketplace, your team or a shared link.",
		window: "Templates",
		search: "Search templates…",
		use: "Use",
		rows: [
			{ name: "Weekly review", detail: "Note · From your team", kind: "note" },
			{ name: "Projects", detail: "Database · Marketplace", kind: "database" },
			{ name: "Meeting notes", detail: "Note · From a link", kind: "note" },
			{ name: "Reading list", detail: "Database · Marketplace", kind: "database" },
		],
		weekly: {
			source: "Weekly review",
			sourceDetail: " · From your team",
			titleBefore: "Week ",
			titleAfter: " review",
			weekChip: "Week number",
			weekValue: "42",
			dateLabel: "Date",
			dateChip: "Today",
			dateValue: "October 13, 2026",
			statusLabel: "Status",
			status: "In progress",
			tagsLabel: "Tags",
			tag: "weekly",
			sections: [
				{ title: "Wins", body: "What went well this week?" },
				{
					title: "Carry over",
					tasks: ["Finish the onboarding guide", "Reply to the design review"],
				},
				{ title: "Next week", body: "Three things that matter most." },
			],
		},
		projects: {
			source: "Projects",
			sourceDetail: " · Marketplace",
			title: "Projects",
			views: ["Table", "Board", "Calendar"],
			columns: ["Name", "Status", "Owner", "Due"],
			rows: [
				{
					name: "Website refresh",
					status: "In progress",
					tone: "rose",
					owner: "AM",
					due: "Oct 20",
				},
				{ name: "Q4 planning", status: "Backlog", tone: "neutral", owner: "BK", due: "Nov 3" },
				{
					name: "Onboarding guide",
					status: "In review",
					tone: "amber",
					owner: "CL",
					due: "Oct 24",
				},
			],
			board: ["Backlog", "In progress", "In review", "Done"],
		},
		facts: [
			"Dates and names filled in for you",
			"Properties, views and sample rows included",
			"Shared by your team or with a link",
		],
		alt: "The Templates window. Weekly review fills in the week number and date, then the Projects database arrives with its rows and switches from Table to Board.",
	},
	share: {
		title: "Made something useful?",
		quiet: "Share it.",
		body: "Everything in the Marketplace started in someone’s own vault. Share a template with your team or with a link, or send a theme or plugin for review so everyone can find it.",
		primaryCta: { label: "Browse the Marketplace", href: "/marketplace/browse" },
		secondaryCta: { label: "Make a theme or plugin", href: "/docs/developers/cli" },
		ways: [
			{
				icon: "template",
				title: "Templates",
				body: "Save any note as a template, then send the link or share it with your team.",
			},
			{
				icon: "theme",
				title: "Themes",
				body: "Choose the colors for light and dark and give Cortex your own look.",
			},
			{
				icon: "plugin",
				title: "Plugins",
				body: "Add the command or view you’ve been missing.",
				link: { label: "The CLI", href: "/cli", after: " sets it up." },
			},
		],
	},
} as const
