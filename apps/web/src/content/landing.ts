export const trustSignals = [
	"Local files",
	"Works offline",
	"Plain Markdown",
	"Open source",
	"Client-side encrypted sync",
] as const

export const trustChips = [
	{
		label: "Local files",
		value: "Source of truth",
	},
	{
		label: "Works offline",
		value: "On",
	},
	{
		label: "Plain Markdown",
		value: ".md",
	},
	{
		label: "Open source",
		value: "Inspectable",
	},
	{
		label: "Client-side encrypted sync",
		value: "Optional",
	},
] as const

export const trustLedger = [
	{
		step: "~/notes",
		label: "Local files",
		description: "Source of truth",
		tone: "amber",
	},
	{
		step: "offline",
		label: "Works offline",
		description: "No account required",
		tone: "sage",
	},
	{
		step: ".md",
		label: "Plain Markdown",
		description: "Readable anywhere",
		tone: "sky",
	},
	{
		step: "open source",
		label: "Open source",
		description: "Inspectable by design",
		tone: "coral",
	},
	{
		step: "encrypted blob",
		label: "Client-side encrypted sync",
		description: "Optional encrypted blobs",
		tone: "amber",
	},
] as const

export const trustContract = {
	title: "A file stays a file.",
	description:
		"Cortex keeps the trust model legible: your folder is the source, Markdown remains readable, and sync only handles encrypted blobs.",
	vault: {
		label: "Local vault",
		path: "~/notes",
		description:
			"Open the same folder in Cortex, Finder, Git, or any Markdown editor. There is no import step to undo later.",
		chips: [".md files", "Offline", "Inspectable"],
	},
	note: "Optional sync stores encrypted blobs; the readable Markdown stays on your devices.",
} as const

export const workspaceDemoSteps = [
	{
		title: "Open any Markdown folder",
		description: "No import ceremony. Cortex reads the folder you already trust.",
	},
	{
		title: "Write in Live Preview",
		description: "Markdown stays editable while structure, links, and callouts stay readable.",
	},
	{
		title: "Search and split",
		description: "Jump to a note, open a split, and keep context visible while you write.",
	},
	{
		title: "Reveal the plain file",
		description: "The last step still points back to a normal Markdown file on disk.",
	},
] as const

export const organizationPanels = [
	{
		title: "Folders",
		description: "Use the structure you already understand, visible in Cortex and everywhere else.",
		tone: "blue",
		items: ["Notes", "Projects", "Research", "Archive"],
	},
	{
		title: "Tags",
		description: "Add lightweight relationships without forcing every note into one hierarchy.",
		tone: "sage",
		items: ["#idea", "#design", "#debugging", "#reading"],
	},
	{
		title: "Bookmarks & properties",
		description: "Keep active notes close and add metadata while the file remains portable.",
		tone: "amber",
		items: ["Status: Draft", "Area: Product", "Pinned", "Reviewed"],
	},
] as const

export const syncProofs = [
	{
		title: "Encrypted before upload",
		description: "Notes are encrypted on your device before Cortex Sync stores encrypted blobs.",
		tone: "amber",
	},
	{
		title: "Inspectable history",
		description:
			"Version history and conflict recovery make changes understandable across devices.",
		tone: "sky",
	},
	{
		title: "Self-hostable path",
		description:
			"Use the hosted service when it fits, or run the open-source sync server yourself.",
		tone: "sage",
	},
	{
		title: "Plain files stay local",
		description:
			"Readable Markdown remains on your devices; the service handles encrypted blob storage.",
		tone: "coral",
	},
] as const

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

export const pricingLedgerItems = [
	{
		title: "Hosted Cortex Sync",
		description:
			"Use the managed sync service for encrypted blob storage without giving up local Markdown files.",
		tone: "amber",
	},
	{
		title: "Client-side encryption",
		description:
			"Sync data is encrypted on your device before upload, so the server handles encrypted blobs.",
		tone: "sage",
	},
	{
		title: "Plain files stay local",
		description:
			"Your vault remains readable on disk, available offline, and portable to other Markdown tools.",
		tone: "sky",
	},
	{
		title: "Self-hostable path",
		description:
			"Run the open-source sync server yourself when hosted Cortex Sync is not the right fit.",
		tone: "coral",
	},
] as const

export const downloadSection = {
	title: "Download",
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

export const developerStories = {
	plugins: {
		label: "Plugins",
		title: "Extend the workspace without making your notes less portable.",
		description:
			"Plugins can extend the parts of Cortex people actually use every day: editing, commands, sidebars, status, settings, and small workflow shortcuts. The notes stay plain Markdown underneath.",
	},
	themes: {
		label: "Themes",
		title: "Change the surface without changing the notes.",
		description:
			"Community themes can reshape Cortex through custom CSS packages while the vault stays plain Markdown. Bring a different mood to the app without making your files depend on it.",
	},
	cli: {
		label: "Cortex CLI",
		title: "Ship extension work from a local vault.",
		description:
			"The CLI mirrors the real extension loop: create a project, run vault-scoped dev mode, build, validate, and prepare publish artifacts when the plugin or theme is ready.",
	},
} as const

export const pluginHighlights = [
	{
		title: "Shape the daily workflow",
		description:
			"Add commands, editor behavior, sidebar views, and status details around the vault without changing how notes are stored.",
		tone: "amber",
	},
	{
		title: "Reviewed before listing",
		description:
			"Marketplace plugins are open source and reviewed by the Cortex team before they are listed for the community.",
		tone: "sage",
	},
] as const

export const pluginExampleNote = {
	title: "The example stays practical",
	description:
		"This small plugin reads like the extension contract: transform Markdown, add a command, and register a view while leaving files alone.",
} as const

export const communityThemeShowcase = {
	image: {
		label: "Community theme preview",
		description:
			"A community dark theme applied to Cortex with custom sidebar, accent, note, and property styling.",
		alt: "Cortex workspace showing a community dark theme with custom colors, side navigation, note properties, and Markdown content.",
		src: "/media/theme.png",
		width: 1648,
		height: 1000,
	},
	points: [
		{
			title: "Theme packages live beside the vault",
			description:
				"Install a custom theme under .cortex/themes and let the package override documented CSS variables and selector hooks.",
		},
		{
			title: "Light and dark are first-class",
			description:
				"A theme manifest can point Cortex to light.css and dark.css so the same personality works across both color schemes.",
		},
		{
			title: "The model stays portable",
			description:
				"Themes can change color, density, radius, and chrome without changing Markdown storage or the commands people rely on.",
		},
	],
} as const

export const cliProofs = [
	{
		title: "Vault-scoped dev",
		description: "Run hot reload against a local Cortex vault with cortex plugin dev --vault.",
	},
	{
		title: "Build and validate",
		description:
			"Build production output, then validate plugin structure and security before release.",
	},
	{
		title: "Publish artifacts",
		description: "Prepare dist/cortex-publish assets for GitHub Releases and registry submission.",
	},
] as const

export const cliFlowSteps = [
	{
		label: "Scaffold",
		description: "Start from the plugin template and install the local project.",
		tone: "amber",
	},
	{
		label: "Develop",
		description: "Run hot reload against the vault you already use for notes.",
		tone: "sage",
	},
	{
		label: "Release",
		description: "Build, validate, and prepare reviewed artifacts for submission.",
		tone: "sky",
	},
] as const

export const cliTerminalTabs = [
	{
		value: "scaffold",
		label: "Scaffold",
		status: "New plugin",
		lines: [
			{ kind: "comment", text: "# Start from the plugin template" },
			{ kind: "command", text: "cortex plugin create github-emoji" },
			{ kind: "success", text: "Plugin 'github-emoji' created successfully" },
			{ kind: "command", text: "cd github-emoji && bun install" },
			{ kind: "success", text: "dependencies installed" },
		],
	},
	{
		value: "develop",
		label: "Develop",
		status: "Vault dev",
		lines: [
			{ kind: "comment", text: "# Run against a real local vault" },
			{ kind: "command", text: "cortex plugin dev --vault ~/notes" },
			{ kind: "success", text: "hot reload running for ~/notes" },
			{ kind: "comment", text: "# Open Cortex and iterate in place" },
			{ kind: "command", text: "cortex plugin inspect github-emoji" },
		],
	},
	{
		value: "release",
		label: "Release",
		status: "Reviewed artifacts",
		lines: [
			{ kind: "comment", text: "# Compile and check the package" },
			{
				kind: "command",
				text: "cortex plugin build && cortex plugin validate",
			},
			{ kind: "success", text: "plugin valid" },
			{ kind: "command", text: "cortex plugin publish" },
			{ kind: "success", text: "artifacts written to dist/cortex-publish" },
		],
	},
] as const

export const cliInstall = {
	title: "Install with npm",
	description: "Add the CLI once, then run Cortex plugin commands from any local vault.",
	command: "npm install -g @cortex.md/cli",
} as const

export const pluginCode = `import { CortexPlugin } from "cortex-plugin-api"
import { GITHUB_EMOJI_MAP } from "./emojiMap"

export default class GitHubEmojiPlugin extends CortexPlugin {

  onload() {

    this.registerMarkdownInline({
      id: "github-emoji",
      pattern: ":([a-z0-9_+-]+):",
      replacement: (match) => GITHUB_EMOJI_MAP[match[1]] ?? match[0],
    })

    this.addCommand({
      id: "insert-emoji",
      label: "Insert Emoji",
      execute: () => this.api.editor.insertAtCursor(":sparkles: "),
    })

    this.registerView({
      id: "emoji-browser",
      label: "Emoji Browser",
      location: "sidebar-left",
    })
  }
}`

export const openSourcePrinciples = [
	{
		title: "Fast by default",
		description: "Quick launch, quick search, and quiet UI stay part of the product standard.",
	},
	{
		title: "Self-hostable sync",
		description:
			"The sync layer is designed so teams can choose hosted service or their own server.",
	},
	{
		title: "Extensible surfaces",
		description: "Plugins and themes can grow around the product without locking notes away.",
	},
	{
		title: "Collaborative by design",
		description:
			"The work happens in public so the community can inspect, discuss, and contribute.",
	},
] as const

export const roadmapStatusGroups = [
	{
		id: "shipped",
		title: "Shipped",
		description: "Core surfaces that already match the local-first Markdown model.",
		items: [
			{
				title: "Local Markdown vaults",
				description:
					"Open an existing folder and keep plain Markdown files as the source of truth.",
				area: "Workspace",
			},
			{
				title: "Live Preview editor",
				description: "Write Markdown while formatting, links, and structure stay readable.",
				area: "Writing",
			},
			{
				title: "Tabs, split panes, and search",
				description: "Move across notes and keep nearby context visible while you work.",
				area: "Navigation",
			},
			{
				title: "Tags, bookmarks, and properties",
				description: "Add lightweight organization without replacing your folder structure.",
				area: "Organize",
			},
			{
				title: "Themes, fonts, and hotkeys",
				description: "Tune the writing surface and shortcuts for longer sessions.",
				area: "Personalization",
			},
			{
				title: "Cortex CLI",
				description: "Build and validate plugin or theme work against a local vault.",
				area: "Developers",
			},
		],
	},
	{
		id: "in-progress",
		title: "In progress",
		description:
			"Product work being shaped around ownership, extension, and understandable change history.",
		items: [
			{
				title: "Cortex Sync",
				description:
					"Optional client-side encryption with encrypted blob storage and a self-hostable path.",
				area: "Sync",
			},
			{
				title: "Version history and conflict recovery",
				description: "Make synced edits easier to inspect and recover across devices.",
				area: "Sync",
			},
			{
				title: "Stable Plugin API",
				description:
					"Harden extension surfaces for commands, Markdown transforms, settings, and views.",
				area: "Developers",
			},
			{
				title: "Community plugin and theme registry",
				description:
					"Create a clearer path for discovering extensions without making notes less portable.",
				area: "Developers",
			},
		],
	},
	{
		id: "planned",
		title: "Planned",
		description: "Future directions that stay separate from the desktop baseline.",
		items: [
			{
				title: "Mobile apps",
				description: "Future clients that keep the local-first Markdown model in mind.",
				area: "Clients",
			},
			{
				title: "Public notes",
				description: "A planned sharing surface for selected Markdown content.",
				area: "Sharing",
			},
		],
	},
] as const

export const availableNow =
	roadmapStatusGroups.find((group) => group.id === "shipped")?.items.map((item) => item.title) ?? []

export const buildingNext = roadmapStatusGroups
	.filter((group) => group.id !== "shipped")
	.flatMap((group) => group.items.map((item) => item.title))

export const footerSocialLinks = [
	{ label: "GitHub", href: "github" },
	{ label: "Discord", soon: true },
	{ label: "Bluesky", soon: true },
	{ label: "Threads", soon: true },
	{ label: "Mastodon", soon: true },
	{ label: "YouTube", soon: true },
] as const

export const footerLinkGroups = [
	{
		title: "Get started",
		links: [
			{ label: "Download", href: "#downloads" },
			{ label: "Pricing", href: "#pricing" },
			{ label: "Account", href: "/account" },
		],
	},
	{
		title: "Cortex",
		links: [
			{ label: "Overview", href: "#product" },
			{ label: "Organize", href: "#organize" },
			{ label: "Sync", href: "#sync" },
			{ label: "Pricing", href: "#pricing" },
			{ label: "Plugins", href: "#developers" },
			{ label: "Themes", href: "#themes" },
		],
	},
	{
		title: "Learn",
		links: [
			{ label: "Docs", href: "/docs" },
			{ label: "FAQ", href: "#faq" },
			{ label: "Changelog", href: "/changelog" },
			{ label: "Roadmap", href: "/roadmap" },
			{ label: "Blog", soon: true },
		],
	},
	{
		title: "Resources",
		links: [
			{ label: "System status", soon: true },
			{ label: "License overview", soon: true },
			{ label: "Terms of service", soon: true },
			{ label: "Privacy policy", soon: true },
			{ label: "Security", soon: true },
		],
	},
	{
		title: "Community",
		links: [
			{ label: "GitHub", href: "github" },
			{ label: "Plugins", href: "#developers" },
			{ label: "Themes", soon: true },
			{ label: "Discord", soon: true },
			{ label: "Contributors", soon: true },
			{ label: "Brand guidelines", soon: true },
		],
	},
] as const

export const frequentlyAskedQuestions = [
	{
		question: "Where are my notes stored?",
		answer:
			"On your computer as Markdown files inside the folder you choose. Cortex works directly with that folder instead of hiding notes in a proprietary database.",
	},
	{
		question: "Does Cortex work without an account?",
		answer:
			"Yes. Local writing and organization do not require an account. An account is only needed for optional hosted services such as Cortex Sync.",
	},
	{
		question: "Can I use an existing Markdown folder?",
		answer:
			"Yes. Cortex is designed around standard Markdown folders, so there is no required import or conversion step.",
	},
	{
		question: "What does open source include?",
		answer:
			"Cortex is built in public with the desktop app, sync service, CLI, and extension tooling available for inspection and collaboration.",
	},
	{
		question: "Which platforms are supported?",
		answer:
			"Cortex is focused on the desktop experience today. The shared product direction keeps future desktop and mobile clients in mind.",
	},
] as const
