export const pricingPlan = {
	name: "Cortex Sync",
	price: "$2",
	cadence: "/ month",
	title: "Hosted sync for the workspace you already own.",
	description:
		"Cortex Sync keeps the local-first model intact: your notes remain plain Markdown, encrypted on your device before the hosted service stores encrypted blobs.",
	ctaLabel: "Upgrade hosted Sync",
	ctaHref: "/billing",
	note: "Self-hosting remains available. The paid plan is for hosted Cortex Sync.",
} as const

export const downloadPlatforms = [
	{
		id: "macos",
		name: "macOS",
		chips: ["Desktop", "Apple Silicon"],
		tone: "amber",
		options: [
			{
				id: "macosDmg",
				label: "Apple Silicon DMG",
				artifact: ".dmg",
				href: "https://github.com/cortex-md/cortex-app/releases/latest/download/Cortex-macos-aarch64.dmg",
				showWhenMissing: true,
			},
			{
				id: "macosIntelDmg",
				label: "Intel DMG",
				artifact: ".dmg",
			},
			{
				id: "macosPackageManager",
				label: "Package manager",
				artifact: "brew",
			},
		],
	},
	{
		id: "windows",
		name: "Windows",
		chips: ["Windows 10+", "x64"],
		tone: "sky",
		options: [
			{
				id: "windowsMsi",
				label: "Windows MSI",
				artifact: ".msi",
				href: "https://github.com/cortex-md/cortex-app/releases/latest/download/Cortex-windows-x64.msi",
				showWhenMissing: true,
			},
			{
				id: "windowsPortable",
				label: "Portable build",
				artifact: ".zip",
			},
			{
				id: "windowsPackageManager",
				label: "Package manager",
				artifact: "winget",
			},
		],
	},
	{
		id: "linux",
		name: "Linux",
		chips: ["x64", "Portable"],
		tone: "sage",
		options: [
			{
				id: "linuxAppImage",
				label: "AppImage",
				artifact: ".AppImage",
				href: "https://github.com/cortex-md/cortex-app/releases/latest/download/Cortex-linux-x64.AppImage",
				showWhenMissing: true,
			},
			{
				id: "linuxDeb",
				label: "Debian package",
				artifact: ".deb",
				href: "https://github.com/cortex-md/cortex-app/releases/latest/download/Cortex-linux-amd64.deb",
			},
			{
				id: "linuxPackageManager",
				label: "Package manager",
				artifact: "repo",
			},
		],
	},
] as const

export const homeHero = {
	title: "Notes you own.",
	quiet: "Everything else, built in.",
	description:
		"A local-first Markdown workspace. Your notes stay plain files in a folder you choose — with databases, tasks, version history and optional encrypted sync.",
	primaryCta: { label: "Download for macOS", href: "#download" },
	secondaryCta: { label: "See all products", href: "#products" },
	availabilityPrefix: "Also on",
	availabilityLink: { label: "Windows and Linux", href: "#download" },
	availabilitySuffix: "· free, no account needed",
	windowTitle: "Work",
	pauseLabel: "Pause the tour",
	playLabel: "Play the tour",
	windowAlt:
		"The Cortex app window touring a note with a new link, a project board and a task typed in plain language.",
} as const

export const heroScenes = [
	{ id: "write", label: "Write", title: "Launch plan" },
	{ id: "organize", label: "Organize", title: "Projects" },
	{ id: "plan", label: "Plan", title: "Today" },
] as const

export const heroSidebar = [
	{ label: "Daily" },
	{ label: "Projects", scene: 1 },
	{ label: "Launch plan", scene: 0, nested: true },
	{ label: "Meetings" },
	{ label: "Today", scene: 2 },
	{ label: "Reading" },
] as const

export const linkScene = {
	path: "Projects / Launch plan.md",
	title: "Launch plan",
	intro: "Ship the beta to the first hundred readers, then collect notes for a week.",
	linePrefix: "Scope and dates are in",
	typing: "[[Road",
	suggestions: [
		{ label: "Roadmap", folder: "Projects", active: true },
		{ label: "Road trip 2026", folder: "Personal" },
		{ label: "Create “Road”" },
	],
	link: "Roadmap",
	backlinksTitle: "Roadmap",
	backlinksLabel: "backlinks",
	backlinks: [
		{ title: "Design review", text: "Blocked until the [[Roadmap]] conflict view lands." },
		{ title: "Sync engine notes", text: "Conflict UI is tracked in [[Roadmap]]." },
	],
	newBacklink: { title: "Launch plan", text: "Scope and dates are in [[Roadmap]]." },
} as const

export const boardScene = {
	path: "Projects · 8 notes",
	title: "Projects",
	views: ["Table", "Board", "Calendar", "Gallery"],
	activeView: "Board",
	columns: [
		{
			name: "Backlog",
			tone: "muted",
			cards: [
				{ title: "Public notes", meta: "Due Oct 21", moving: true },
				{ title: "Templates v3", meta: "No date" },
			],
		},
		{
			name: "In progress",
			tone: "accent",
			cards: [
				{ title: "Sync beta", meta: "Due Oct 14" },
				{ title: "Database views", meta: "Due Oct 18" },
			],
		},
		{ name: "Done", tone: "success", cards: [{ title: "Conflict view", meta: "Oct 9" }] },
	],
} as const

export const taskScene = {
	path: "New task",
	typed: "Pay rent every month on the 5th at 9am",
	chips: ["Nov 5 · 09:00", "Every month on the 5th", "Remind me"],
	line: "- [ ] Pay rent 📅 2026-11-05 09:00 🔁 every month on the 5th ⏰",
	toastTitle: "Pay rent",
	toastMeta: "Due at 09:00 · Finance.md",
	toastActions: ["Snooze 10 min", "Mark done"],
} as const

export interface FeatureStoryCopy {
	title: string
	description: string
	points: readonly string[]
}

export const organizeGroup = {
	id: "organize",
	title: "Organize without leaving",
	quiet: "Markdown.",
	description: "Structure comes from the notes themselves, so nothing is locked inside Cortex.",
	databases: {
		title: "Databases from plain notes",
		description:
			"Point a folder at a database and every note in it becomes a row. Switch between table, board, calendar and gallery without exporting anything — the properties live in each note’s frontmatter, so the same files still open in any editor, git or script.",
		points: [
			"Filters, sorts, groups and manual order, saved per view",
			"Row templates for new entries, like a project brief",
			"Start from Projects, Meetings, Reading list or a CRM board",
		],
	},
	tasks: {
		title: "Tasks that remind you",
		description:
			"Write a task the way you’d say it — “pay rent every month on the 5th at 9am” — and Cortex writes the date, the repeat and the reminder into the checkbox line. Today pulls tasks from every note, and reminders arrive as system notifications you can snooze.",
		points: [
			"The Obsidian Tasks format, so existing vaults just work",
			"Repeating tasks move to the next date when checked",
			"Quiet hours and a morning digest",
		],
	},
} as const

export const keepGroup = {
	id: "keep",
	title: "Nothing you write",
	quiet: "gets lost.",
	description: "History and imports work on every vault — synced or not.",
	history: {
		title: "Every version, kept",
		description:
			"Cortex saves versions of each note as you write, on your own disk. Compare any two, see exactly what changed and who changed it, and bring back an older text without losing today’s — restoring saves the current version first.",
		points: [
			"Every save from the last 24 hours, then one per day for 30 days",
			"Follows a note through renames and moves",
			"Deleted notes can be brought back too",
		],
	},
	obsidian: {
		title: "Bring your Obsidian vault",
		description:
			"Copy a vault into Cortex or open it where it already is. Notes, folders and attachments come over as they are; image embeds are converted, and your daily notes, templates and bookmarks settings move with them.",
		points: [
			"Your Obsidian vault is never modified",
			"Anything Cortex can’t show yet — like Dataview — is listed, never dropped",
			"Existing files are never overwritten",
		],
	},
} as const

export const togetherGroup = {
	id: "together",
	title: "Write together,",
	quiet: "privately.",
	description: "Share a vault with your team and edit the same note at the same time.",
	collaboration: {
		title: "Live, with everyone’s cursor",
		description:
			"See who’s in a note, follow along as they type and leave a comment on the exact sentence. Edits are merged as you go, so there’s nothing to resolve later.",
		points: [
			"Presence, live cursors and selections",
			"Comments anchored to text, with mentions",
			"End-to-end encrypted rooms on Cortex Sync",
		],
	},
} as const

export const databaseMock = {
	title: "Projects",
	hint: "Click a view",
	views: [
		{ id: "table", label: "Table" },
		{ id: "board", label: "Board" },
		{ id: "gallery", label: "Gallery" },
	],
	tableHeaders: ["Name", "Status", "Due"],
	boardColumns: ["Backlog", "In progress", "Done"],
	rows: [
		{ name: "Sync beta", status: "In progress", tone: "progress", due: "Oct 14" },
		{ name: "Public notes", status: "Backlog", tone: "backlog", due: "Oct 21" },
		{ name: "Conflict view", status: "Done", tone: "done", due: "Oct 9" },
		{ name: "Database views", status: "In progress", tone: "progress", due: "Oct 18" },
		{ name: "Templates v3", status: "Backlog", tone: "backlog", due: "—" },
	],
} as const

export const tasksMock = {
	title: "Today",
	placeholder: "Add a task — try “call mom tomorrow at 6pm”",
	addLabel: "Add",
	inputLabel: "Add a task",
	defaultLine: "- [ ] Pay rent 📅 2026-11-05 09:00 🔁 every month ⏰",
	tasks: [
		{ id: 1, title: "Pay rent", meta: "Nov 5 · 09:00 · every month", repeats: true },
		{ id: 2, title: "Call the bank", meta: "Today · 15:00" },
		{ id: 3, title: "Draft the announcement", meta: "Today · Launch plan" },
		{ id: 4, title: "Weekly review", meta: "Today · 17:00 · every week" },
	],
	repeatedMeta: "Dec 5 · 09:00 · every month",
	repeatedMessage: "Pay rent repeats — next on Dec 5",
	addedMessage: "Added to Inbox.md",
	notification: { title: "Call the bank", meta: "In 10 minutes · Finance.md", action: "Snooze" },
} as const

export const historyMock = {
	file: "Launch plan.md",
	changesLabel: "Changes",
	fullLabel: "Full note",
	currentLabel: "Current version",
	restoreLabel: "Restore this version",
	pickHint: "Pick an older version to compare.",
	undoLabel: "Undo",
	versions: [
		{
			time: "14:20",
			who: "Ana · MacBook",
			day: "Today",
			diff: [
				["ctx", "## This week"],
				["del", "Ship the beta to the first fifty readers."],
				["add", "Ship the beta to the first hundred readers,"],
				["add", "then collect notes for a week."],
				["ctx", "- [x] Conflict view for sync"],
				["add", "- [ ] Invite list goes out Monday"],
			],
		},
		{
			time: "11:05",
			who: "Bruno · iPhone",
			day: "Today",
			diff: [
				["ctx", "## Announcement"],
				["add", "Lead with plain files on disk,"],
				["add", "then show sync and the CLI."],
				["ctx", "## This week"],
			],
		},
		{
			time: "18:42",
			who: "Ana · MacBook",
			day: "Yesterday",
			diff: [
				["ctx", "## This week"],
				["del", "- [ ] Conflict view for sync"],
				["add", "- [x] Conflict view for sync"],
				["ctx", "## Later"],
			],
		},
		{
			time: "09:10",
			who: "Ana · MacBook",
			day: "Oct 2",
			diff: [
				["add", "# Launch plan"],
				["add", "Ship the beta to the first fifty readers."],
				["add", "## This week"],
				["add", "- [ ] Conflict view for sync"],
			],
		},
	],
	fullNote: [
		"# Launch plan",
		"Ship the beta to the first hundred readers,",
		"then collect notes for a week.",
		"## This week",
		"- [x] Conflict view for sync",
		"- [ ] Invite list goes out Monday",
	],
} as const

export const obsidianMock = {
	sourceName: "Second brain",
	sourceApp: "Obsidian",
	targetName: "Work",
	targetApp: "Cortex",
	sourceEntries: [".obsidian/", "Attachments/", "Daily/", "Projects/", "Templates/", "Inbox.md"],
	copiedEntries: ["Attachments/", "Daily/", "Projects/", "Templates/", "Inbox.md"],
	moved: "Settings, templates and bookmarks moved",
	summary: "1,284 notes · 312 attachments · 37 Dataview queries listed for review",
	totalFiles: 1596,
	importLabel: "Import Second brain",
	runningLabel: "Importing…",
	againLabel: "Run it again",
} as const

export const collaborationMock = {
	title: "Launch plan",
	people: [
		{ id: "ana", initials: "AM", name: "Ana" },
		{ id: "bruno", initials: "BK", name: "Bruno" },
		{ id: "carla", initials: "CL", name: "Carla" },
	],
	sectionTitle: "Announcement",
	selectionBefore: "We ship the beta to the first hundred readers, then",
	selection: "collect notes for a week",
	selectionAfter: "before the public launch.",
	announcement: "Lead with plain files on disk, then show sync and the CLI.",
	typed: "Keep it under two hundred words.",
	anchor: "Invite list goes out Monday",
	anchorAfter: "from the shared inbox.",
	comment: "Can we include the Design team?",
	replyPlaceholder: "Reply…",
	sendLabel: "Send",
	linePlaceholder: "Write a line here — the others see it as you type",
	lineLabel: "Write in the shared note",
	footer: "Changes are encrypted on each device before they reach the server.",
} as const

export const realWorkGroup = {
	title: "Made for",
	quiet: "real work.",
	description: "The details that make it hold up every day.",
	links: {
		title: "Notes that link both ways",
		description:
			"Type [[ to link any note. Every note shows what links back to it, so ideas connect without folders or tags.",
	},
	search: {
		title: "Search that keeps up",
		description:
			"Search runs off the main thread, so typing stays smooth in large vaults. Filter by tag, path or file name right in the query.",
		query: "launch",
		hits: [
			{ before: "", mark: "Launch", after: " plan · Projects" },
			{ before: "Sync beta · “before ", mark: "launch", after: "”" },
			{ before: "Weekly review · “", mark: "launch", after: " notes”" },
		],
	},
} as const

export type ProductCardArt = "desktop" | "mobile" | "sync" | "marketplace" | "cli"

export const productCards: ReadonlyArray<{
	art: ProductCardArt
	title: string
	description: string
	href?: string
	cta?: string
	pill?: { label: string; tone: "soon" | "new" }
	painting: "dawn" | "coast" | "meadow" | "dusk" | "mist" | "wheat"
	position: string
}> = [
	{
		art: "desktop",
		title: "Desktop",
		description: "The full workspace for macOS, Windows and Linux.",
		href: "#download",
		cta: "Download",
		painting: "mist",
		position: "center 60%",
	},
	{
		art: "mobile",
		title: "Mobile",
		description: "Your vault and plugins on iOS and Android.",
		href: "/mobile",
		cta: "Learn more",
		pill: { label: "In development", tone: "soon" },
		painting: "dawn",
		position: "center 75%",
	},
	{
		art: "sync",
		title: "Sync",
		description: "Encrypted sync, history and members. Hosted or on your server.",
		href: "/sync",
		cta: "Learn more",
		painting: "coast",
		position: "center 50%",
	},
	{
		art: "marketplace",
		title: "Marketplace",
		description: "Plugins and themes, reviewed before they’re listed.",
		href: "/marketplace",
		cta: "Browse",
		painting: "meadow",
		position: "center 70%",
	},
	{
		art: "cli",
		title: "CLI",
		description: "Build, test and publish plugins from your terminal.",
		href: "/cli",
		cta: "Learn more",
		painting: "dusk",
		position: "center 55%",
	},
]

export const productsGroup = {
	id: "products",
	title: "One vault,",
	quiet: "wherever you write.",
	desktopTitle: "Roadmap",
	cliCommand: "cortex plugin create",
	cliResult: "✓ Created word-count",
} as const

export const openSourceSplit = {
	title: "Open source, and careful with your files.",
	description:
		"Cortex never moves your notes into a database. Plugins and themes change what you see, not what’s on disk.",
	points: [
		{
			icon: "shield",
			text: "Community plugins stay off until you turn them on, and show what they can access first.",
		},
		{ icon: "file", text: "Notes, tasks and database rows are Markdown you can open anywhere." },
		{ icon: "github", text: "The code is on GitHub. Issues and the roadmap are public." },
	],
} as const

export const pricingSection = {
	id: "pricing",
	title: "Free to write.",
	quiet: "Pay only to sync.",
	description:
		"Every feature of the editor is free, forever. Pay only if you want us to run sync for you.",
	recommended: "Recommended",
	compareLabel: "Compare every feature",
	hideCompareLabel: "Hide the comparison",
	faqTitle: "Questions about pricing",
	fine: "Prices in US dollars. Taxes may apply depending on where you live.",
} as const

export const pricingPlans = [
	{
		id: "local",
		name: "Local",
		who: "For writing on one computer.",
		price: "Free",
		priceNote: "forever",
		note: "No account needed.",
		cta: { label: "Download", href: "#download" },
		featured: false,
		lead: "Everything to write and organize:",
		features: [
			"The full Markdown editor",
			"Databases, tasks and reminders",
			"Templates, daily notes and properties",
			"Plugins and themes",
			"Local version history",
		],
	},
	{
		id: "sync",
		name: pricingPlan.name,
		who: "For every device you own, and the people you work with.",
		price: pricingPlan.price,
		priceNote: "per month",
		note: "Billed monthly. Manage it from your account.",
		cta: { label: "Start syncing", href: pricingPlan.ctaHref },
		featured: true,
		lead: "Everything in Local, plus:",
		features: [
			"Sync across all your devices",
			"End-to-end encrypted on your device",
			"History and recovery everywhere",
			"Members, roles and live collaboration",
		],
	},
	{
		id: "self-hosted",
		name: "Self-hosted",
		who: "For teams that want the server on their own machines.",
		price: "Free",
		priceNote: "open source",
		note: "You run and update the server.",
		cta: { label: "Read the guide", href: "/docs/sync/overview" },
		featured: false,
		lead: "Everything in Cortex Sync, on your server:",
		features: [
			"Same apps, same encryption",
			"Your storage and backups",
			"Members and invites",
			"Admin controls for public links",
		],
	},
] as const

export const pricingComparison = {
	columns: ["Local", "Cortex Sync", "Self-hosted"],
	groups: [
		{
			title: "Writing",
			rows: [
				{ label: "Markdown editor, tabs and split panes", values: [true, true, true] },
				{ label: "Databases, tasks and reminders", values: [true, true, true] },
				{ label: "Templates, daily notes and properties", values: [true, true, true] },
				{ label: "Plugins and themes", values: [true, true, true] },
				{ label: "Local version history", values: [true, true, true] },
				{ label: "Works offline, no account", values: [true, true, true] },
			],
		},
		{
			title: "Sync",
			rows: [
				{ label: "Sync between your devices", values: [false, true, true] },
				{ label: "End-to-end encrypted", values: [false, true, true] },
				{ label: "Version history and deleted notes on every device", values: [false, true, true] },
				{ label: "Members, roles and invites", values: [false, true, true] },
				{ label: "Live collaboration and comments", values: [false, true, true] },
				{ label: "Publish a note to the web", values: [false, true, true] },
			],
		},
		{
			title: "Hosting",
			rows: [
				{ label: "We run and update the server", values: [false, true, false] },
				{ label: "Runs on your own machine or cloud", values: [false, false, true] },
			],
		},
	],
} as const

export const pricingFaq = [
	{
		question: "Do I need an account to use Cortex?",
		answer:
			"No. Writing, databases, tasks, templates and local history work without an account. You only sign in for Cortex Sync.",
	},
	{
		question: `What do I get for ${pricingPlan.price} a month?`,
		answer:
			"Hosted, end-to-end encrypted sync for your vaults across your devices, plus history and recovery on every device, members and live collaboration, and publishing to the web.",
	},
	{
		question: "What happens to my notes if I stop paying?",
		answer:
			"Nothing. They stay on your devices as Markdown files. Sync stops, and you can turn it on again or move to a self-hosted server whenever you like.",
	},
	{
		question: "Is self-hosting really free?",
		answer:
			"Yes. The sync server is open source. You run it on your own machine or cloud and connect the same apps to it.",
	},
] as const

export const recentlyShipped = {
	title: "Recently shipped",
	href: "/changelog",
	items: [
		{
			area: "Editor",
			title: "Mermaid diagrams",
			description: "Render diagrams in place, or expand them into their own tab.",
		},
		{
			area: "Files",
			title: "A PDF viewer",
			description: "Open PDFs in their own tab and keep your notes beside them.",
		},
		{
			area: "Editor",
			title: "Math and export",
			description: "Math in Live Preview and Reading mode, plus HTML, PDF and CSV export.",
		},
		{
			area: "Drawing",
			title: "Excalidraw views",
			description: "Sketch in a tab of its own while your notes stay open.",
		},
	],
} as const

export const downloadSection = {
	id: "download",
	title: "Open a folder.",
	quiet: "Start writing.",
	buttons: [
		{ platform: "macos", label: "Download for macOS", primary: true },
		{ platform: "windows", label: "Windows", primary: false },
		{ platform: "linux", label: "Linux", primary: false },
	],
} as const
