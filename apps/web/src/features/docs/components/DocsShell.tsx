import { Button } from "@cortex/ui/button"
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui/command"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@cortex/ui/sheet"
import { Check, ChevronRight, Copy, FileText, Hash, Menu, Search } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { ThemeToggle } from "../../site/ThemeToggle"
import { createDocLlmText } from "../llms"
import type { DocPage, DocsNavigationGroup, DocsSearchEntry } from "../registry"
import { docsSearchEntries } from "../registry"
import { DocsMarkdown } from "./DocsMarkdown"

interface DocsShellProps {
	page: DocPage
	navigation: DocsNavigationGroup[]
}

interface DocsSidebarProps {
	currentSlug: string
	navigation: DocsNavigationGroup[]
}

interface TocIndicator {
	top: number
	height: number
	visible: boolean
}

function cn(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ")
}

function ShortcutKey({ children }: { children: ReactNode }) {
	return (
		<kbd className="pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-bg-elevated px-1.5 font-sans text-[11px] leading-none font-medium text-text-muted select-none">
			{children}
		</kbd>
	)
}

function navigateToHref(href: string) {
	if (typeof window === "undefined") return

	const [pathname, hash] = href.split("#")
	if (hash && pathname === window.location.pathname) {
		window.history.pushState(null, "", href)
		document.getElementById(hash)?.scrollIntoView({ block: "start" })
		return
	}

	window.location.href = href
}

function DocsSearchCommand() {
	const [open, setOpen] = useState(false)
	const pageEntries = useMemo(() => docsSearchEntries.filter((entry) => entry.type === "page"), [])
	const headingEntries = useMemo(
		() => docsSearchEntries.filter((entry) => entry.type === "heading"),
		[],
	)

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault()
				setOpen((current) => !current)
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [])

	function renderEntry(entry: DocsSearchEntry) {
		const Icon = entry.type === "page" ? FileText : Hash

		return (
			<CommandItem
				key={entry.id}
				className="cursor-pointer rounded-md px-3 py-2 text-text-primary data-[selected=true]:bg-accent-subtle data-[selected=true]:text-accent-text"
				value={entry.searchText}
				onSelect={() => {
					setOpen(false)
					navigateToHref(entry.href)
				}}
			>
				<Icon className="size-4 text-text-muted" aria-hidden="true" />
				<span className="min-w-0 flex-1">
					<span className="block truncate text-[14px] leading-5 font-medium">{entry.title}</span>
					<span className="block truncate text-[12px] leading-4 text-text-muted">
						{entry.description}
					</span>
				</span>
				<span className="shrink-0 text-[11px] leading-4 text-text-muted">{entry.section}</span>
			</CommandItem>
		)
	}

	return (
		<>
			<button
				type="button"
				className="mx-auto flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg bg-bg-secondary px-3 text-left text-[14px] text-text-muted shadow-[0_0_0_1px_var(--border-subtle)] transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-bg-elevated hover:text-text-secondary hover:shadow-[0_0_0_1px_var(--border)] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.96]"
				aria-label="Search docs"
				onClick={() => setOpen(true)}
			>
				<Search className="size-4 shrink-0" aria-hidden="true" />
				<span className="min-w-0 flex-1 truncate">Search docs...</span>
				<span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
					<ShortcutKey>⌘</ShortcutKey>
					<ShortcutKey>K</ShortcutKey>
				</span>
			</button>

			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				title="Search docs"
				description="Search Cortex documentation pages and headings."
				className="docs-shell border-border-subtle bg-bg-elevated p-0 text-text-primary shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
				commandProps={{
					className: "bg-transparent text-text-primary",
				}}
			>
				<CommandInput
					className="text-text-primary placeholder:text-text-muted"
					placeholder="Search docs..."
				/>
				<CommandList className="max-h-[420px] px-2 py-2">
					<CommandEmpty>No docs found.</CommandEmpty>
					<CommandGroup heading="Pages">{pageEntries.map(renderEntry)}</CommandGroup>
					<CommandGroup heading="Headings">{headingEntries.map(renderEntry)}</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	)
}

function DocsHomeLink() {
	return (
		<a
			className="inline-grid size-10 shrink-0 place-items-center rounded-lg transition-[background-color,scale] duration-150 ease-out hover:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.96]"
			href="/"
			aria-label="Cortex home"
		>
			<img className="block rounded-lg" src="/icon-192.png" width={28} height={28} alt="" />
		</a>
	)
}

function DocsSidebar({ currentSlug, navigation }: DocsSidebarProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Docs navigation">
				<div className="grid gap-7">
					{navigation.map((group) => (
						<section key={group.section}>
							<h2 className="mb-2 px-2 text-[12px] leading-4 font-semibold text-text-muted">
								{group.section}
							</h2>
							<ul className="grid gap-0.5">
								{group.pages.map((item) => {
									const isActive = item.slug === currentSlug
									return (
										<li key={item.slug}>
											<a
												className={cn(
													"flex min-h-9 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[14px] leading-5 font-medium transition-[background-color,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
													isActive
														? "bg-accent-subtle text-accent-foreground"
														: "text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
												)}
												href={item.href}
												aria-current={isActive ? "page" : undefined}
											>
												<span>{item.title}</span>
												{isActive ? (
													<ChevronRight className="size-4 shrink-0" aria-hidden="true" />
												) : null}
											</a>
										</li>
									)
								})}
							</ul>
						</section>
					))}
				</div>
			</nav>
		</div>
	)
}

function getInitialHeadingId(page: DocPage) {
	if (typeof window !== "undefined") {
		const hashId = window.location.hash.replace(/^#/u, "")
		if (hashId && page.headings.some((heading) => heading.id === hashId)) return hashId
	}

	return page.headings[0]?.id
}

function useActiveHeading(page: DocPage) {
	const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(() =>
		getInitialHeadingId(page),
	)

	useEffect(() => {
		const elements = page.headings
			.map((heading) => document.getElementById(heading.id))
			.filter((element): element is HTMLElement => Boolean(element))

		setActiveHeadingId(getInitialHeadingId(page))

		if (elements.length === 0) return undefined

		function setHeadingFromScrollPosition() {
			const current =
				elements.filter((element) => element.getBoundingClientRect().top <= 92).at(-1) ??
				elements[0]
			setActiveHeadingId(current?.id)
		}

		const Observer = (window as Window & { IntersectionObserver?: typeof IntersectionObserver })
			.IntersectionObserver

		if (!Observer) {
			setHeadingFromScrollPosition()
			window.addEventListener("scroll", setHeadingFromScrollPosition, { passive: true })
			return () => window.removeEventListener("scroll", setHeadingFromScrollPosition)
		}

		const visibleHeadings = new Map<string, number>()
		const observer = new Observer(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visibleHeadings.set(entry.target.id, entry.boundingClientRect.top)
					} else {
						visibleHeadings.delete(entry.target.id)
					}
				}

				const visible = [...visibleHeadings.entries()].sort((left, right) => left[1] - right[1])
				if (visible[0]) {
					setActiveHeadingId(visible[0][0])
					return
				}

				setHeadingFromScrollPosition()
			},
			{
				rootMargin: "-88px 0px -65% 0px",
				threshold: [0, 1],
			},
		)

		for (const element of elements) observer.observe(element)
		return () => observer.disconnect()
	}, [page])

	return activeHeadingId
}

function DocsCopyPageButton({ page }: { page: DocPage }) {
	const [copied, setCopied] = useState(false)

	async function handleCopy() {
		const origin = typeof window === "undefined" ? undefined : window.location.origin
		await navigator.clipboard.writeText(createDocLlmText(page, origin))
		setCopied(true)
		window.setTimeout(() => setCopied(false), 1800)
	}

	return (
		<div className="grid gap-2">
			<Button
				className="h-9 justify-start gap-2 border-border-subtle bg-bg-elevated px-3 text-[13px] text-text-secondary shadow-[0_0_0_1px_var(--border-subtle)] transition-[background-color,color,scale] duration-150 ease-out hover:bg-bg-secondary hover:text-text-primary active:scale-[0.96]"
				variant="outline"
				size="sm"
				type="button"
				onClick={handleCopy}
			>
				{copied ? (
					<Check className="size-4 text-accent-text" aria-hidden="true" />
				) : (
					<Copy className="size-4" aria-hidden="true" />
				)}
				{copied ? "Copied" : "Copy page"}
			</Button>
			<div className="grid gap-0.5">
				<a
					className="inline-flex min-h-8 items-center rounded-md px-3 text-[12px] leading-4 text-text-muted transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
					href="/llms.txt"
				>
					LLMs index
				</a>
				<a
					className="inline-flex min-h-8 items-center rounded-md px-3 text-[12px] leading-4 text-text-muted transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
					href="/docs/llms.txt"
				>
					Full docs corpus
				</a>
			</div>
		</div>
	)
}

function DocsTableOfContents({
	page,
	activeHeadingId,
	showCopy = false,
}: {
	page: DocPage
	activeHeadingId: string | undefined
	showCopy?: boolean
}) {
	const listRef = useRef<HTMLUListElement | null>(null)
	const linkRefs = useRef(new Map<string, HTMLAnchorElement>())
	const [indicator, setIndicator] = useState<TocIndicator>({
		top: 0,
		height: 0,
		visible: false,
	})

	useEffect(() => {
		const activeLink = activeHeadingId ? linkRefs.current.get(activeHeadingId) : undefined
		if (!activeLink) {
			setIndicator((current) => ({ ...current, visible: false }))
			return undefined
		}

		const activeElement = activeLink

		function syncIndicator() {
			setIndicator({
				top: activeElement.offsetTop,
				height: activeElement.offsetHeight,
				visible: true,
			})
		}

		syncIndicator()
		window.addEventListener("resize", syncIndicator)
		return () => window.removeEventListener("resize", syncIndicator)
	}, [activeHeadingId])

	if (page.headings.length === 0) return null

	return (
		<div>
			<nav aria-label="On this page">
				<h2 className="mb-4 text-[12px] leading-4 font-semibold text-text-primary">On this page</h2>
				<ul ref={listRef} className="relative grid gap-1 pl-3">
					<span
						className="docs-toc-indicator absolute left-0 w-px rounded-full bg-accent"
						style={{
							height: indicator.height,
							opacity: indicator.visible ? 1 : 0,
							transform: `translateY(${indicator.top}px)`,
						}}
						aria-hidden="true"
					/>
					{page.headings.map((heading) => {
						const isActive = heading.id === activeHeadingId

						return (
							<li key={heading.id}>
								<a
									ref={(node) => {
										if (node) linkRefs.current.set(heading.id, node)
										else linkRefs.current.delete(heading.id)
									}}
									className={cn(
										"block rounded-md py-0.5 text-[13px] leading-5 transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
										heading.depth === 3 && "pl-4",
										isActive ? "text-accent-text" : "text-text-muted",
									)}
									href={`#${heading.id}`}
									aria-current={isActive ? "location" : undefined}
								>
									{heading.text}
								</a>
							</li>
						)
					})}
				</ul>
			</nav>
			{showCopy ? (
				<div className="mt-6 border-border-subtle border-t pt-4">
					<DocsCopyPageButton page={page} />
				</div>
			) : null}
		</div>
	)
}

function MobileDocsNav(props: DocsSidebarProps) {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					className="border-border-subtle bg-bg-elevated text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:hidden"
					variant="outline"
					size="sm"
				>
					<Menu className="size-4" aria-hidden="true" />
					Docs
				</Button>
			</SheetTrigger>
			<SheetContent
				className="docs-shell border-border bg-bg-primary/95 text-text-primary backdrop-blur-xl"
				side="left"
			>
				<SheetHeader>
					<SheetTitle>Cortex Docs</SheetTitle>
					<SheetDescription>Browse documentation topics.</SheetDescription>
				</SheetHeader>
				<div className="min-h-0 flex-1 px-4 pb-5">
					<DocsSidebar {...props} />
				</div>
			</SheetContent>
		</Sheet>
	)
}

function MobileTableOfContents({
	page,
	activeHeadingId,
}: {
	page: DocPage
	activeHeadingId: string | undefined
}) {
	if (page.headings.length === 0) return null

	return (
		<details className="mt-8 rounded-lg bg-bg-secondary p-3 shadow-[0_0_0_1px_var(--border-subtle)] xl:hidden">
			<summary className="cursor-pointer text-[13px] leading-5 font-semibold text-text-primary">
				On this page
			</summary>
			<div className="mt-3">
				<DocsTableOfContents page={page} activeHeadingId={activeHeadingId} showCopy />
			</div>
		</details>
	)
}

export function DocsShell({ page, navigation }: DocsShellProps) {
	const activeHeadingId = useActiveHeading(page)
	const sidebarProps = {
		currentSlug: page.slug,
		navigation,
	}

	return (
		<div className="docs-shell min-h-screen bg-bg-primary text-text-primary">
			<div className="sticky top-0 z-30 border-border-subtle border-b bg-bg-primary/90 backdrop-blur-xl">
				<div className="mx-auto flex h-14 w-[min(100%,1440px)] items-center gap-3 px-4 md:px-6">
					<div className="flex w-[132px] shrink-0 items-center gap-2 max-sm:w-[124px]">
						<DocsHomeLink />
						<MobileDocsNav {...sidebarProps} />
					</div>
					<div className="min-w-0 flex-1">
						<DocsSearchCommand />
					</div>
					<div className="flex w-[132px] shrink-0 justify-end max-sm:w-10">
						<ThemeToggle />
					</div>
				</div>
			</div>

			<div className="mx-auto grid w-[min(100%,1440px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_240px]">
				<aside className="sticky top-14 hidden h-[calc(100vh-56px)] border-border-subtle border-r p-5 lg:flex">
					<DocsSidebar {...sidebarProps} />
				</aside>

				<main id="main-content" className="min-w-0 px-5 py-10 md:px-8 md:py-14">
					<article className="mx-auto max-w-[var(--markdown-content-width)]">
						<p className="mb-3 text-[13px] leading-5 font-medium text-text-muted">{page.section}</p>
						<h1 className="text-balance text-[40px] leading-[1.05] font-semibold tracking-normal text-text-primary max-md:text-[34px]">
							{page.title}
						</h1>
						<p className="mt-5 text-pretty text-[17px] leading-7 text-text-secondary">
							{page.description}
						</p>
						<MobileTableOfContents page={page} activeHeadingId={activeHeadingId} />
						<div className="mt-10">
							<DocsMarkdown code={page.mdx} />
						</div>
					</article>
				</main>

				<aside className="sticky top-14 hidden h-[calc(100vh-56px)] px-6 py-9 xl:block">
					<DocsTableOfContents page={page} activeHeadingId={activeHeadingId} showCopy />
				</aside>
			</div>
		</div>
	)
}
