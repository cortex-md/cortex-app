import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@cortex/ui/command"
import { Kbd } from "@cortex/ui/kbd"
import { cn } from "@cortex/ui/lib/utils"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@cortex/ui/sheet"
import {
	BookOpen,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	FileText,
	Hash,
	Menu,
	PencilLine,
	Search,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { docsCopy, docsSourceBaseUrl } from "../../../content/docs"
import { createDocLlmText } from "../llmsPage"
import type { DocPage, DocsNavigationSummaryGroup, DocsSearchEntry } from "../registry"
import { DocsMarkdown } from "./DocsMarkdown"

interface DocsShellProps {
	page: DocPage
	navigation: DocsNavigationSummaryGroup[]
	loadSearchEntries: () => Promise<DocsSearchEntry[]>
}

interface DocsSidebarProps {
	currentSlug: string
	navigation: DocsNavigationSummaryGroup[]
	onSearch: () => void
}

const focusRing = "outline-none focus-visible:shadow-focus"
const wordsPerMinute = 220

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

function getReadingMinutes(page: DocPage) {
	const words = page.content.split(/\s+/u).filter(Boolean).length
	return Math.max(1, Math.round(words / wordsPerMinute))
}

function getAdjacentPages(page: DocPage, navigation: DocsNavigationSummaryGroup[]) {
	const pages = navigation.flatMap((group) => group.pages)
	const index = pages.findIndex((item) => item.slug === page.slug)
	return { previous: pages[index - 1], next: pages[index + 1] }
}

function useDocsSearchShortcut(setOpen: (update: (open: boolean) => boolean) => void) {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault()
				setOpen((current) => !current)
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [setOpen])
}

function DocsSearchDialog({
	open,
	onOpenChange,
	loadSearchEntries,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	loadSearchEntries: () => Promise<DocsSearchEntry[]>
}) {
	const [entries, setEntries] = useState<DocsSearchEntry[]>([])

	useEffect(() => {
		if (!open || entries.length > 0) return
		let active = true
		loadSearchEntries()
			.then((loaded) => {
				if (active) setEntries(loaded)
			})
			.catch(() => {})
		return () => {
			active = false
		}
	}, [open, entries.length, loadSearchEntries])

	const pageEntries = useMemo(() => entries.filter((entry) => entry.type === "page"), [entries])
	const headingEntries = useMemo(
		() => entries.filter((entry) => entry.type === "heading"),
		[entries],
	)

	function renderEntry(entry: DocsSearchEntry) {
		const Icon = entry.type === "page" ? FileText : Hash

		return (
			<CommandItem
				key={entry.id}
				className="rounded-md px-3 py-2 text-text-primary data-[selected=true]:bg-brand-subtle data-[selected=true]:text-brand-text"
				value={entry.searchText}
				onSelect={() => {
					onOpenChange(false)
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
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title={docsCopy.searchLabel}
			description={docsCopy.searchDescription}
			className="bg-bg-elevated p-0 text-text-primary shadow-panel"
			commandProps={{ className: "bg-transparent text-text-primary" }}
		>
			<CommandInput
				className="text-text-primary placeholder:text-text-muted"
				placeholder={docsCopy.searchPlaceholder}
			/>
			<CommandList className="max-h-[420px] px-2 py-2">
				<CommandEmpty>{docsCopy.searchEmpty}</CommandEmpty>
				<CommandGroup heading="Pages">{pageEntries.map(renderEntry)}</CommandGroup>
				<CommandGroup heading="Headings">{headingEntries.map(renderEntry)}</CommandGroup>
			</CommandList>
		</CommandDialog>
	)
}

function SearchButton({ onSearch }: { onSearch: () => void }) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-[38px] w-full items-center gap-2 rounded-[10px] bg-bg-elevated pr-2 pl-3 text-left text-[14px] leading-none text-text-muted shadow-ring transition-colors hover:text-text-secondary",
				focusRing,
			)}
			aria-label={docsCopy.searchLabel}
			onClick={onSearch}
		>
			<Search className="size-4 shrink-0" aria-hidden="true" />
			<span className="flex-1" aria-hidden="true">
				{docsCopy.searchLabel}
			</span>
			<Kbd className="rounded-md bg-bg-elevated text-[11px] text-text-secondary shadow-[0_0_0_1px_var(--border),0_1px_0_var(--border)]">
				⌘
			</Kbd>
			<Kbd className="rounded-md bg-bg-elevated text-[11px] text-text-secondary shadow-[0_0_0_1px_var(--border),0_1px_0_var(--border)]">
				K
			</Kbd>
		</button>
	)
}

function DocsNavGroup({
	group,
	currentSlug,
}: {
	group: DocsNavigationSummaryGroup
	currentSlug: string
}) {
	const containsCurrent = group.pages.some((item) => item.slug === currentSlug)
	const [isOpen, setIsOpen] = useState(containsCurrent || group.pages.length <= 2)
	const listId = `docs-group-${group.sectionOrder}`

	return (
		<div className="mt-5">
			<button
				type="button"
				className={cn(
					"flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] font-semibold text-text-primary",
					focusRing,
				)}
				aria-expanded={isOpen}
				aria-controls={listId}
				onClick={() => setIsOpen((open) => !open)}
			>
				{group.section}
				<ChevronDown
					className={cn(
						"ml-auto size-3.5 text-text-muted transition-transform duration-150 ease-out motion-reduce:transition-none",
						!isOpen && "-rotate-90",
					)}
					aria-hidden="true"
				/>
			</button>
			<ul
				id={listId}
				hidden={!isOpen}
				className="mt-0.5 ml-2 flex flex-col gap-px border-sep border-l pl-2.5"
			>
				{group.pages.map((item) => {
					const isActive = item.slug === currentSlug
					return (
						<li key={item.slug}>
							<a
								className={cn(
									"-ml-[11px] flex min-h-[30px] items-center gap-2 border-l border-transparent px-2.5 py-1 text-[14px] leading-[18px] text-text-secondary transition-colors hover:text-text-primary aria-[current=page]:border-brand aria-[current=page]:font-medium aria-[current=page]:text-brand-text max-[1000px]:min-h-10",
									focusRing,
								)}
								href={item.href}
								aria-current={isActive ? "page" : undefined}
							>
								{item.title}
							</a>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function DocsSidebar({ currentSlug, navigation, onSearch }: DocsSidebarProps) {
	return (
		<>
			<SearchButton onSearch={onSearch} />
			<nav aria-label={docsCopy.navigationLabel}>
				{navigation.map((group) => (
					<DocsNavGroup key={group.section} group={group} currentSlug={currentSlug} />
				))}
			</nav>
		</>
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
				elements.filter((element) => element.getBoundingClientRect().top <= 100).at(-1) ??
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
			{ rootMargin: "-96px 0px -65% 0px", threshold: [0, 1] },
		)

		for (const element of elements) observer.observe(element)
		return () => observer.disconnect()
	}, [page])

	return activeHeadingId
}

function DocsPageActions({ page }: { page: DocPage }) {
	const [copied, setCopied] = useState(false)
	const actionClass = cn(
		"inline-flex items-center gap-1.5 rounded-md py-1 text-[13px] leading-none text-text-secondary transition-colors hover:text-text-primary max-[1100px]:min-h-10",
		focusRing,
	)

	async function handleCopy() {
		const origin = typeof window === "undefined" ? undefined : window.location.origin
		try {
			await navigator.clipboard.writeText(createDocLlmText(page, origin))
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1800)
		} catch {
			setCopied(false)
		}
	}

	return (
		<div className="mt-6 flex flex-col items-start gap-1.5 border-sep border-t pt-4">
			<button type="button" className={actionClass} onClick={handleCopy}>
				{copied ? (
					<Check className="size-3.5 text-brand-text" aria-hidden="true" />
				) : (
					<Copy className="size-3.5" aria-hidden="true" />
				)}
				{copied ? docsCopy.copied : docsCopy.copyPage}
			</button>
			<a className={actionClass} href="/llms.txt">
				<FileText className="size-3.5" aria-hidden="true" />
				{docsCopy.llmsIndex}
			</a>
			<a className={actionClass} href="/docs/llms.txt">
				<BookOpen className="size-3.5" aria-hidden="true" />
				{docsCopy.llmsCorpus}
			</a>
		</div>
	)
}

function DocsTableOfContents({
	page,
	activeHeadingId,
}: {
	page: DocPage
	activeHeadingId: string | undefined
}) {
	return (
		<>
			{page.headings.length > 0 ? (
				<nav aria-label={docsCopy.onThisPage}>
					<h2 className="text-[12px] leading-4 font-semibold text-text-primary">
						{docsCopy.onThisPage}
					</h2>
					<ul className="mt-2.5 flex flex-col gap-0.5 border-sep border-l">
						{page.headings.map((heading) => {
							const isActive = heading.id === activeHeadingId
							return (
								<li key={heading.id}>
									<a
										className={cn(
											"-ml-px block border-l border-transparent py-[5px] pl-3 text-[13px] leading-[18px] text-text-muted transition-colors hover:text-text-primary aria-[current=location]:border-brand aria-[current=location]:text-brand-text",
											heading.depth === 3 && "pl-6",
											focusRing,
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
			) : null}
			<DocsPageActions page={page} />
		</>
	)
}

function MobileDocsNav({ currentSlug, navigation, onSearch }: DocsSidebarProps) {
	const [open, setOpen] = useState(false)

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				className={cn(
					"inline-flex h-10 items-center gap-2 rounded-full bg-bg-elevated px-4 text-[14px] leading-none font-medium text-text-primary shadow-ring",
					focusRing,
				)}
			>
				<Menu className="size-4" aria-hidden="true" />
				{docsCopy.mobileNavigationLabel}
			</SheetTrigger>
			<SheetContent
				side="left"
				className="w-[min(320px,86vw)] overflow-y-auto border-0 bg-site-panel p-0 text-text-primary shadow-panel backdrop-blur-none"
			>
				<SheetHeader className="px-5 pt-5 pb-0">
					<SheetTitle className="text-[17px] font-semibold">{docsCopy.rootCrumb}</SheetTitle>
					<SheetDescription className="text-[13px] text-text-muted">
						{docsCopy.mobileNavigationDescription}
					</SheetDescription>
				</SheetHeader>
				<div className="px-4 pt-3 pb-8">
					<DocsSidebar
						currentSlug={currentSlug}
						navigation={navigation}
						onSearch={() => {
							setOpen(false)
							onSearch()
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	)
}

export function DocsShell({ page, navigation, loadSearchEntries }: DocsShellProps) {
	const activeHeadingId = useActiveHeading(page)
	const [searchOpen, setSearchOpen] = useState(false)
	const openSearch = () => setSearchOpen(true)
	const { previous, next } = getAdjacentPages(page, navigation)
	const sidebarProps = { currentSlug: page.slug, navigation, onSearch: openSearch }

	useDocsSearchShortcut(setSearchOpen)

	return (
		<div className="mx-auto grid w-[min(1360px,100%)] grid-cols-[264px_minmax(0,1fr)_224px] max-[1100px]:grid-cols-[240px_minmax(0,1fr)] max-[820px]:grid-cols-[minmax(0,1fr)]">
			<aside className="sticky top-[68px] h-[calc(100dvh-68px)] self-start overflow-y-auto pt-6 pr-4 pb-10 pl-6 max-[820px]:hidden">
				<DocsSidebar {...sidebarProps} />
			</aside>

			<div className="min-w-0 px-12 pt-8 pb-20 max-[820px]:px-5 max-[820px]:pt-6 max-[820px]:pb-16">
				<article className="mx-auto max-w-[720px]">
					<div className="mb-5 hidden max-[820px]:block">
						<MobileDocsNav {...sidebarProps} />
					</div>
					<nav aria-label="Breadcrumb">
						<ol className="flex flex-wrap items-center gap-1.5 text-[13px] leading-none text-text-muted">
							<li>{docsCopy.rootCrumb}</li>
							<li aria-hidden="true">
								<ChevronRight className="size-3" />
							</li>
							<li>{page.section}</li>
							<li aria-hidden="true">
								<ChevronRight className="size-3" />
							</li>
							<li className="text-text-primary" aria-current="page">
								{page.title}
							</li>
						</ol>
					</nav>
					<h1 className="mt-4 text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em] text-text-primary max-sm:text-[38px]">
						{page.title}
					</h1>
					<p className="mt-3.5 max-w-[620px] text-[17px] leading-[1.6] text-text-secondary max-sm:text-[16.5px]">
						{page.description}
					</p>
					<div className="mt-[18px] flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] leading-[1.4] text-text-muted">
						<span>{docsCopy.minutesRead(getReadingMinutes(page))}</span>
						<a
							className={cn(
								"inline-flex items-center gap-1 rounded-sm text-text-secondary hover:text-text-primary",
								focusRing,
							)}
							href={`${docsSourceBaseUrl}/${page.slug}.mdx`}
							target="_blank"
							rel="noreferrer"
						>
							<PencilLine className="size-3.5" aria-hidden="true" />
							{docsCopy.editOnGitHub}
						</a>
					</div>

					<div className="mt-9">
						<DocsMarkdown code={page.mdx} />
					</div>

					<nav
						className="mt-12 grid grid-cols-2 gap-2.5 max-[820px]:grid-cols-1"
						aria-label="Pagination"
					>
						{previous ? (
							<a
								className={cn(
									"flex flex-col gap-1 rounded-[14px] px-[18px] py-4 shadow-ring hover:shadow-[0_0_0_1px_var(--accent-border)]",
									focusRing,
								)}
								href={previous.href}
							>
								<small className="text-[12px] leading-none text-text-muted">
									{docsCopy.previous}
								</small>
								<b className="text-[15px] leading-[1.3] font-semibold text-text-primary">
									← {previous.title}
								</b>
							</a>
						) : (
							<span aria-hidden="true" className="max-[820px]:hidden" />
						)}
						{next ? (
							<a
								className={cn(
									"flex flex-col gap-1 rounded-[14px] px-[18px] py-4 text-right shadow-ring hover:shadow-[0_0_0_1px_var(--accent-border)]",
									focusRing,
								)}
								href={next.href}
							>
								<small className="text-[12px] leading-none text-text-muted">{docsCopy.next}</small>
								<b className="text-[15px] leading-[1.3] font-semibold text-text-primary">
									{next.title} →
								</b>
							</a>
						) : null}
					</nav>

					<div className="mt-10 hidden max-[1100px]:block">
						<DocsTableOfContents page={page} activeHeadingId={activeHeadingId} />
					</div>
				</article>
			</div>

			<aside className="sticky top-[68px] max-h-[calc(100dvh-68px)] self-start overflow-y-auto pt-8 pr-6 pb-10 pl-2 max-[1100px]:hidden">
				<DocsTableOfContents page={page} activeHeadingId={activeHeadingId} />
			</aside>

			<DocsSearchDialog
				open={searchOpen}
				onOpenChange={setSearchOpen}
				loadSearchEntries={loadSearchEntries}
			/>
		</div>
	)
}
