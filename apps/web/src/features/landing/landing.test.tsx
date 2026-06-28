import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProductMedia } from "./components/ProductMedia"
import { LandingPage } from "./LandingPage"
import { DownloadSection } from "./sections/DownloadSection"

const highlightedPluginCodeHtml = `<pre class="shiki cortex-shiki" style="background-color: transparent; color: #f3f3f3"><code><span class="line"><span style="color: #fb7185">import</span> { <span style="color: #90b8e0">CortexPlugin</span> } <span style="color: #fb7185">from</span> <span style="color: #7ecaa0">"cortex-plugin-api"</span></span>
<span class="line"><span style="color: #fb7185">import</span> { <span style="color: #90b8e0">GITHUB_EMOJI_MAP</span> } <span style="color: #fb7185">from</span> <span style="color: #7ecaa0">"./emojiMap"</span></span>
<span class="line"><span style="color: #fb7185">export default class</span> <span style="color: #90b8e0">GitHubEmojiPlugin</span> <span style="color: #fb7185">extends</span> CortexPlugin {</span>
<span class="line">  onload() {</span>
<span class="line">    this.registerMarkdownInline({ id: <span style="color: #7ecaa0">"github-emoji"</span> })</span>
<span class="line">    this.addCommand({ id: <span style="color: #7ecaa0">"insert-emoji"</span> })</span>
<span class="line">    this.registerView({ id: <span style="color: #7ecaa0">"emoji-browser"</span> })</span>
<span class="line">  }</span>
<span class="line">}</span></code></pre>`

function renderLanding() {
	return render(<LandingPage pluginCodeHtml={highlightedPluginCodeHtml} />)
}

describe("LandingPage", () => {
	it("renders the redesigned product narrative", () => {
		const { container } = renderLanding()

		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "A Markdown workspace for notes you actually own.",
			}),
		).toBeTruthy()
		expect(
			screen.getByRole("heading", {
				name: "Write, find, and arrange without losing the thread.",
			}),
		).toBeTruthy()
		expect(
			screen.getByRole("heading", {
				name: "Structure that adapts to how you already think.",
			}),
		).toBeTruthy()
		expect(
			screen.getByRole("heading", {
				name: "Sync is optional, encrypted, and yours to host.",
			}),
		).toBeTruthy()
		expect(
			screen.getByRole("heading", {
				name: "Extend the workspace without making your notes less portable.",
			}),
		).toBeTruthy()
		expect(
			screen.getByRole("heading", {
				name: "Sync when you want it. The files stay yours.",
			}),
		).toBeTruthy()
		expect(screen.getByText("$2")).toBeTruthy()
		expect(screen.getByText("/ month")).toBeTruthy()
		expect(screen.getByRole("link", { name: /Upgrade hosted Sync/i }).getAttribute("href")).toBe(
			"/billing",
		)
		expect(
			screen
				.getAllByRole("link", { name: "Pricing" })
				.some((link) => link.getAttribute("href") === "#pricing"),
		).toBe(true)
		expect(screen.getAllByText("Cortex Sync").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText(/Self-hosting remains available/i)).toBeTruthy()
		expect(screen.queryByText(/early access/i)).toBeNull()
		expect(screen.queryByLabelText("Email address")).toBeNull()
		expect(screen.queryByRole("heading", { name: "Available now" })).toBeNull()
		expect(screen.queryByRole("heading", { name: "Building next" })).toBeNull()
		expect(screen.queryByText("Writing and navigation")).toBeNull()
		expect(screen.queryByText("See the workspace")).toBeNull()
		expect(container.querySelector('[class*="font-mono"]')).toBeNull()
		expect(container.querySelector('[class*="font-display"]')).toBeNull()
	})

	it("renders the fixed glass product navigation bar", () => {
		const { container } = renderLanding()

		const header = container.querySelector("header")
		const siteNav = container.querySelector("[data-glass-nav]")
		const resourcesTrigger = screen.getByRole("button", { name: /Resources/i })
		expect(header?.className).toContain("fixed")
		expect(siteNav?.className).toContain("rounded-xl")
		expect(siteNav?.className).toContain("backdrop-blur-xl")
		expect(siteNav?.className).toContain("[background:var(--site-header-glass)]")
		expect(siteNav?.className).toContain("[box-shadow:var(--site-header-shadow)]")
		expect(siteNav?.className).not.toContain("border-white/60")
		expect(siteNav?.className).not.toContain("0_18px")
		expect(screen.getByRole("link", { name: "Login" }).getAttribute("href")).toBe(
			"/login?redirect=/account",
		)
		expect(
			screen
				.getAllByRole("link", { name: "Pricing" })
				.some((link) => link.getAttribute("href") === "#pricing"),
		).toBe(true)
		expect(screen.getByRole("button", { name: /Switch to/i })).toBeTruthy()
		expect(resourcesTrigger.getAttribute("aria-expanded")).toBe("false")
		fireEvent.focus(resourcesTrigger)
		expect(resourcesTrigger.getAttribute("aria-expanded")).toBe("true")
		const resourcesMenu = screen.getByRole("region", { name: "Resources menu" })
		expect(resourcesMenu.className).toContain("top-full")
		expect(resourcesMenu.className).toContain("pt-2")
		expect(within(resourcesMenu).getByRole("link", { name: /Docs/i }).getAttribute("href")).toBe(
			"/docs",
		)
		expect(within(resourcesMenu).getByRole("link", { name: /FAQ/i }).getAttribute("href")).toBe(
			"#faq",
		)
		expect(
			within(resourcesMenu)
				.getByRole("link", { name: /Changelog/i })
				.getAttribute("href"),
		).toBe("/changelog")
		expect(
			within(resourcesMenu)
				.getByRole("link", { name: /Roadmap/i })
				.getAttribute("href"),
		).toBe("/roadmap")
		fireEvent.keyDown(resourcesTrigger, { key: "Escape" })
		expect(resourcesTrigger.getAttribute("aria-expanded")).toBe("false")
		expect(screen.queryByRole("link", { name: "Developers" })).toBeNull()
	})

	it("renders the trust section as a compact file ledger", () => {
		const { container } = renderLanding()
		const trustStrip = container.querySelector('[data-trust-strip="file-contract"]')
		const trustLedger = container.querySelector('[data-trust-ledger="stack"]')

		expect(
			screen.getByRole("heading", {
				name: "A file stays a file.",
			}),
		).toBeTruthy()
		expect(trustStrip).toBeTruthy()
		expect(trustLedger?.tagName).toBe("DL")
		expect(trustLedger?.className).not.toContain("overflow-x-auto")
		expect(trustLedger?.className).not.toContain("grid-cols-5")
		expect(trustLedger?.querySelectorAll("dt")).toHaveLength(5)
		expect(trustLedger?.querySelector("ol")).toBeNull()
		expect(screen.getByText("Local vault")).toBeTruthy()
		expect(screen.getByText(".md files")).toBeTruthy()
		expect(screen.getByText("Inspectable")).toBeTruthy()
		expect(screen.getByText(/There is no import step/i)).toBeTruthy()
		expect(screen.getAllByText("~/notes").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("offline")).toBeTruthy()
		expect(screen.getByText(".md")).toBeTruthy()
		expect(screen.getByText("encrypted blob")).toBeTruthy()
		expect(screen.getByText("Source of truth")).toBeTruthy()
		expect(screen.getByText("Local files")).toBeTruthy()
		expect(screen.getByText("Works offline")).toBeTruthy()
		expect(screen.getByText("Plain Markdown")).toBeTruthy()
		expect(screen.getAllByText("Open source").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Client-side encrypted sync")).toBeTruthy()
		expect(screen.getAllByText(/encrypted blobs/i).length).toBeGreaterThanOrEqual(1)
	})

	it("turns writing into a guided workflow instead of repeated cards", () => {
		renderLanding()

		expect(screen.getByText("Open any Markdown folder")).toBeTruthy()
		expect(screen.getByText("Write in Live Preview")).toBeTruthy()
		expect(screen.getByText("Search and split")).toBeTruthy()
		expect(screen.getByText("Reveal the plain file")).toBeTruthy()
		expect(screen.getByAltText(/writing workspace/i)).toBeTruthy()
	})

	it("uses one organization surface instead of decorative color cards", () => {
		renderLanding()

		expect(screen.getByRole("heading", { name: /Structure that adapts/i })).toBeTruthy()
		expect(screen.getByText(/folders when the hierarchy is obvious/i)).toBeTruthy()
		expect(screen.getByAltText(/organization workspace/i)).toBeTruthy()
	})

	it("keeps sync claims precise and visually tied to encrypted blob storage", () => {
		renderLanding()

		expect(screen.getAllByText(/client-side encryption/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/encrypted blob storage/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Encrypted before upload")).toBeTruthy()
		expect(screen.getAllByText("Plain files stay local").length).toBeGreaterThanOrEqual(1)
		expect(screen.queryByText(/end-to-end encrypted/i)).toBeNull()
	})

	it("renders plugins, themes, and CLI as separated developer sections", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		})

		const { container } = renderLanding()

		expect(container.querySelector("main > #developers")).toBeTruthy()
		expect(container.querySelector("main > #themes")).toBeTruthy()
		expect(container.querySelector("main > #cli")).toBeTruthy()
		expect(screen.queryByRole("heading", { name: /A plugin API that can be read/i })).toBeNull()
		expect(screen.queryByText("Plugin API example")).toBeNull()
		const pluginCode = container.querySelector('[data-highlighted-code="plugin-api"]')
		const pluginCodeFigure = pluginCode?.closest("figure")
		expect(pluginCode).toBeTruthy()
		expect(pluginCodeFigure?.querySelector("ol")).toBeNull()
		expect(container.querySelector(".cortex-shiki")).toBeTruthy()
		expect(screen.getAllByText(/CortexPlugin/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/GitHubEmojiPlugin/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/registerMarkdownInline/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/insert-emoji/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/emoji-browser/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText(/Plugins can extend the parts of Cortex/i)).toBeTruthy()
		expect(screen.getByText("Shape the daily workflow")).toBeTruthy()
		expect(screen.getByText(/Add commands, editor behavior, sidebar views/i)).toBeTruthy()
		expect(screen.getByText("Reviewed before listing")).toBeTruthy()
		expect(screen.getByText(/Marketplace plugins are open source/i)).toBeTruthy()
		expect(screen.queryByText(/definePlugin/i)).toBeNull()
		expect(screen.queryByText(/capture-highlight/i)).toBeNull()
		expect(screen.queryByText("Runtime surfaces")).toBeNull()
		expect(
			screen.getByRole("heading", { name: "Change the surface without changing the notes." }),
		).toBeTruthy()
		const themeImage = screen.getByAltText(
			"Cortex workspace showing a community dark theme with custom colors, side navigation, note properties, and Markdown content.",
		)
		expect(themeImage.getAttribute("src")).toBe("/media/theme.png")
		expect(themeImage.getAttribute("loading")).toBe("lazy")
		expect(themeImage.getAttribute("fetchpriority")).toBe("auto")
		expect(themeImage.getAttribute("width")).toBe("1648")
		expect(themeImage.getAttribute("height")).toBe("1000")
		expect(screen.getByText(/custom CSS packages/i)).toBeTruthy()
		expect(screen.getByText(/.cortex\/themes/i)).toBeTruthy()
		expect(screen.getByText(/light.css/i)).toBeTruthy()
		expect(screen.getByText(/dark.css/i)).toBeTruthy()
		expect(screen.getByText("Theme packages live beside the vault")).toBeTruthy()
		expect(screen.getByText("Light and dark are first-class")).toBeTruthy()
		expect(screen.getByText("The model stays portable")).toBeTruthy()
		expect(screen.queryByText("Paper")).toBeNull()
		expect(screen.queryByText("Ink")).toBeNull()
		expect(screen.queryByText("Amber")).toBeNull()
		expect(
			screen.getByRole("heading", { name: "Ship extension work from a local vault." }),
		).toBeTruthy()
		expect(screen.getByLabelText("Cortex CLI examples")).toBeTruthy()
		const cliLayout = container.querySelector('[data-cli-layout="terminal-with-flow"]')
		const cliFlow = container.querySelector('[data-cli-flow="side"]')
		expect(cliLayout).toBeTruthy()
		expect(cliLayout?.querySelector('aside[aria-label="CLI release flow"]')).toBeTruthy()
		expect(cliFlow).toBeTruthy()
		expect(cliFlow?.className).not.toContain("grid-cols-3")
		expect(container.querySelector("[data-cli-install]")).toBeTruthy()
		expect(screen.getByText("npm install -g @cortex.md/cli")).toBeTruthy()
		const copyCliInstallButton = screen.getByRole("button", {
			name: "Copy CLI install command",
		})
		await act(async () => {
			fireEvent.click(copyCliInstallButton)
		})
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npm install -g @cortex.md/cli")
			expect(screen.getByRole("button", { name: "CLI install command copied" })).toBeTruthy()
		})
		const scaffoldTab = screen.getByRole("tab", { name: "Scaffold" })
		const developTab = screen.getByRole("tab", { name: "Develop" })
		const releaseTab = screen.getByRole("tab", { name: "Release" })
		expect(scaffoldTab.getAttribute("data-state")).toBe("active")
		expect(screen.queryByText("Vault-scoped dev")).toBeNull()
		expect(screen.queryByText("Build and validate")).toBeNull()
		expect(screen.getAllByText(/Scaffold/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/Develop/i).length).toBeGreaterThanOrEqual(1)
		expect(screen.getAllByText(/Release/i).length).toBeGreaterThanOrEqual(1)
		const hasCliCommand = (command: string) =>
			Array.from(container.querySelectorAll("[data-command]")).some(
				(element) => element.getAttribute("data-command") === command,
			)
		expect(hasCliCommand("cortex plugin create github-emoji")).toBe(true)
		fireEvent.mouseDown(developTab, { button: 0, ctrlKey: false })
		expect(developTab.getAttribute("data-state")).toBe("active")
		expect(hasCliCommand("cortex plugin dev --vault ~/notes")).toBe(true)
		expect(hasCliCommand("cortex plugin inspect github-emoji")).toBe(true)
		fireEvent.mouseDown(releaseTab, { button: 0, ctrlKey: false })
		expect(releaseTab.getAttribute("data-state")).toBe("active")
		expect(hasCliCommand("cortex plugin build && cortex plugin validate")).toBe(true)
		expect(hasCliCommand("cortex plugin publish")).toBe(true)
		expect(screen.queryByText(/cortex plugins/i)).toBeNull()
		expect(screen.queryByText(/pack --local/i)).toBeNull()
		expect(screen.getByRole("link", { name: /View source/i })).toBeTruthy()
	})

	it("renders sync media bare and applies live accent tokens inside the unified background", () => {
		const { container } = renderLanding()

		const syncImage = screen.getByAltText(
			"Cortex Sync technical illustration showing Markdown files, encrypted blobs, and connected devices.",
		)
		const syncFigure = syncImage.closest("figure")
		expect(syncFigure?.getAttribute("data-media-frame")).toBe("bare")
		expect(syncFigure?.getAttribute("data-image-scale")).toBe("sync")
		expect(syncImage.getAttribute("width")).toBe("1307")
		expect(syncImage.getAttribute("height")).toBe("557")
		expect(syncImage.className).toContain("scale-[1.12]")
		expect(syncFigure?.className).not.toContain("bg-bg-secondary")
		expect(syncFigure?.className).not.toContain("shadow-[")
		expect(syncFigure?.className).not.toContain("rounded-xl")
		expect(syncImage.className).not.toContain("outline")
		expect(container.querySelector('[class*="bg-accent-sky-subtle"]')).toBeTruthy()
		expect(container.querySelector('[class*="bg-accent-coral-subtle"]')).toBeTruthy()
	})

	it("keeps main sections on a unified light background", () => {
		const { container } = renderLanding()

		const mainSections = Array.from(container.querySelectorAll("main > section"))
		expect(mainSections.length).toBeGreaterThan(6)
		for (const section of mainSections) {
			expect(section.className).not.toContain("border-y")
			expect(section.className).not.toContain("border-t")
			expect(section.className).not.toContain("bg-bg-secondary")
			expect(section.className).not.toContain("bg-[#11100f]")
		}
	})

	it("places paid Sync after the FAQ and Downloads as the final landing section", () => {
		const { container } = renderLanding()
		const sectionIds = Array.from(container.querySelectorAll("main > section")).map((section) =>
			section.getAttribute("id"),
		)

		expect(sectionIds.at(-3)).toBe("faq")
		expect(sectionIds.at(-2)).toBe("pricing")
		expect(sectionIds.at(-1)).toBe("downloads")
	})

	it("renders download platform cards without dead links by default", () => {
		const { container } = renderLanding()
		const downloadsElement = container.querySelector("#downloads")
		expect(downloadsElement).toBeTruthy()

		const downloads = within(downloadsElement as HTMLElement)
		expect(
			downloads.getByRole("heading", {
				name: "Download",
			}),
		).toBeTruthy()
		expect(downloads.getByRole("heading", { name: "macOS" })).toBeTruthy()
		expect(downloads.getByRole("heading", { name: "Windows" })).toBeTruthy()
		expect(downloads.getByRole("heading", { name: "Linux" })).toBeTruthy()
		expect(downloads.getByText(".dmg")).toBeTruthy()
		expect(downloads.getByText(".exe")).toBeTruthy()
		expect(downloads.getByText(".AppImage")).toBeTruthy()
		expect(downloads.getByText("Apple Silicon")).toBeTruthy()
		expect(downloads.getByText("Windows 10+")).toBeTruthy()
		expect(downloads.getByText("Portable")).toBeTruthy()
		expect(downloadsElement?.querySelectorAll("svg[data-platform-mark]")).toHaveLength(3)
		expect(downloadsElement?.querySelector('[data-platform-mark="macos"]')).toBeTruthy()
		expect(downloadsElement?.querySelector('[data-platform-mark="windows"]')).toBeTruthy()
		expect(downloadsElement?.querySelector('[data-platform-mark="linux"]')).toBeTruthy()
		expect(downloadsElement?.querySelectorAll('[aria-disabled="true"]')).toHaveLength(3)
		expect(downloads.queryAllByText("Soon")).toHaveLength(0)
		expect(downloads.queryAllByRole("link")).toHaveLength(0)
	})

	it("enables only configured download URLs", () => {
		render(
			<DownloadSection
				links={{
					macos: "https://downloads.example.com/cortex.dmg",
					windows: "",
					linux: "https://downloads.example.com/cortex.AppImage",
				}}
			/>,
		)

		expect(
			screen.getByRole("link", { name: "Download Cortex for macOS" }).getAttribute("href"),
		).toBe("https://downloads.example.com/cortex.dmg")
		expect(
			screen.getByRole("link", { name: "Download Cortex for Linux" }).getAttribute("href"),
		).toBe("https://downloads.example.com/cortex.AppImage")
		expect(screen.queryByRole("link", { name: "Download Cortex for Windows" })).toBeNull()
	})

	it("renders a dark footer with future resources marked as soon", () => {
		renderLanding()

		expect(screen.getByRole("navigation", { name: "Get started links" })).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Cortex links" })).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Learn links" })).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Resources links" })).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Community links" })).toBeTruthy()
		expect(screen.getAllByText("Soon").length).toBeGreaterThan(6)
		expect(screen.getByRole("link", { name: "Download" }).getAttribute("href")).toBe("#downloads")
		expect(
			screen
				.getAllByRole("link", { name: "Pricing" })
				.some((link) => link.getAttribute("href") === "#pricing"),
		).toBe(true)
		expect(
			screen
				.getAllByRole("link", { name: "Docs" })
				.some((link) => link.getAttribute("href") === "/docs"),
		).toBe(true)
		expect(screen.getByRole("link", { name: "Changelog" }).getAttribute("href")).toBe("/changelog")
		expect(screen.getByRole("link", { name: "Roadmap" }).getAttribute("href")).toBe("/roadmap")
		expect(screen.getByRole("link", { name: "Account" }).getAttribute("href")).toBe("/account")
		expect(screen.queryByText("Early access")).toBeNull()
		expect(screen.queryByText("Developers")).toBeNull()
		expect(screen.getAllByRole("link", { name: "GitHub" }).length).toBeGreaterThanOrEqual(2)
		expect(screen.queryByText("English")).toBeNull()
	})

	it("does not repeat the old feature-card grid pattern across every section", () => {
		const { container } = renderLanding()

		expect(container.querySelectorAll("[data-feature-card]").length).toBeLessThan(4)
	})

	it("uses the local FAQ accordion with smooth collapse animation", () => {
		const { container } = renderLanding()

		const question = screen.getByRole("button", { name: /Where are my notes stored/i })
		expect(question.querySelector(".faq-answer-icon")).toBeNull()
		expect(question.querySelector("svg")).toBeTruthy()
		expect(question.className).not.toContain("[&>svg]:hidden")
		fireEvent.click(question)
		expect(screen.getByText(/inside the folder you choose/i)).toBeTruthy()
		const content = container.querySelector("[data-slot='landing-accordion-content']")
		expect(content?.className).toContain("grid-rows")
		expect(content?.querySelector("div")?.className).toContain("translate-y")
	})

	it("keeps every named media slot accessible", () => {
		renderLanding()

		expect(
			screen.getByAltText(
				"Cortex Sync technical illustration showing Markdown files, encrypted blobs, and connected devices.",
			),
		).toBeTruthy()
		expect(
			screen.getByAltText(
				"Cortex workspace showing a community dark theme with custom colors, side navigation, note properties, and Markdown content.",
			),
		).toBeTruthy()
		expect(screen.queryByAltText(/Placeholder/i)).toBeNull()
		expect(screen.queryByText(/Placeholder/i)).toBeNull()
	})
})

describe("ProductMedia", () => {
	it("loads the hero eagerly and reserves image dimensions", () => {
		const { container } = render(
			<ProductMedia
				label="Hero"
				description="Primary product view"
				alt="Primary product view"
				src="/media/cortex-workspace.svg"
				webpSrc="/media/cortex-workspace.webp"
				priority
			/>,
		)

		const image = screen.getByAltText("Primary product view")
		const webpSource = container.querySelector('source[type="image/webp"]')
		expect(webpSource?.getAttribute("srcset")).toBe("/media/cortex-workspace.webp")
		expect(image.getAttribute("loading")).toBe("eager")
		expect(image.getAttribute("fetchpriority")).toBe("high")
		expect(image.getAttribute("width")).toBe("1600")
		expect(image.getAttribute("height")).toBe("1000")
		expect(screen.getByText("Hero. Primary product view")).toBeTruthy()
	})
})
