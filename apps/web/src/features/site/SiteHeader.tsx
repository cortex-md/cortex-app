import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@cortex/ui/dropdown-menu"
import { cn } from "@cortex/ui/lib/utils"
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "@cortex/ui/sheet"
import { useRouterState } from "@tanstack/react-router"
import {
	ArrowUpRight,
	ChevronDown,
	Cloud,
	Globe,
	Laptop,
	type LucideIcon,
	Menu,
	Smartphone,
	Store,
	Terminal,
	X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { siteConfig } from "../../config/site"
import {
	headerActions,
	mobileNavLinks,
	type ProductIcon,
	type ProductNavItem,
	primaryNavLinks,
	productFeature,
	productNavGroups,
	resourceNavLinks,
	siteTagline,
} from "../../content/site"
import { trackEvent } from "../../lib/analytics"
import { type AuthSessionResult, getSession } from "../../server/auth"
import { CortexMark } from "./CortexMark"
import { ThemeToggle } from "./ThemeToggle"

const productIcons: Record<ProductIcon, LucideIcon> = {
	desktop: Laptop,
	mobile: Smartphone,
	cli: Terminal,
	sync: Cloud,
	publish: Globe,
	marketplace: Store,
}

const focusRing = "outline-none focus-visible:shadow-focus"
const navLinkClass = cn(
	"group inline-flex min-h-10 items-center gap-1 rounded-lg px-3 py-2 text-[13px] leading-5 font-medium text-text-secondary transition-[background-color,color] duration-150 ease-out hover:bg-site-hover hover:text-text-primary aria-[current=page]:text-text-primary data-[current]:text-text-primary aria-expanded:bg-site-hover aria-expanded:text-text-primary data-[state=open]:bg-site-hover data-[state=open]:text-text-primary",
	focusRing,
)
const panelClass =
	"animate-panel-in rounded-xl border-0 bg-site-panel p-2 text-text-primary shadow-panel backdrop-blur-none motion-reduce:animate-none"
const panelItemClass =
	"group cursor-default rounded-lg px-3 py-2.5 text-text-primary focus:bg-site-hover data-[highlighted]:bg-site-hover"
const hoverArrowClass =
	"size-3.5 shrink-0 scale-[0.25] opacity-0 blur-[4px] transition-[opacity,scale,filter] duration-200 ease-out group-hover:scale-100 group-hover:opacity-70 group-hover:blur-0 group-focus:scale-100 group-focus:opacity-70 group-focus:blur-0 group-data-[highlighted]:scale-100 group-data-[highlighted]:opacity-70 group-data-[highlighted]:blur-0 motion-reduce:transition-none"

type HeaderSession =
	| { status: "unknown" }
	| { status: "signedOut" }
	| { status: "signedIn"; email: string }

interface SiteHeaderProps {
	sessionLoader?: () => Promise<AuthSessionResult>
}

function loadHeaderSession() {
	return getSession()
}

function useHeaderSession(sessionLoader: () => Promise<AuthSessionResult>) {
	const [session, setSession] = useState<HeaderSession>({ status: "unknown" })

	useEffect(() => {
		let isMounted = true
		sessionLoader()
			.then((result) => {
				if (!isMounted) return
				setSession(
					result.authenticated
						? { status: "signedIn", email: result.session.email }
						: { status: "signedOut" },
				)
			})
			.catch(() => {
				if (isMounted) setSession({ status: "signedOut" })
			})
		return () => {
			isMounted = false
		}
	}, [sessionLoader])

	return session
}

function isCurrentPath(pathname: string, href: string) {
	if (href.startsWith("/#") || href.startsWith("http")) return false
	return pathname === href || pathname.startsWith(`${href}/`)
}

function getAccountInitial(email: string) {
	return email.trim().charAt(0).toUpperCase() || "C"
}

function Pill({ label, tone }: { label: string; tone: "new" | "soon" }) {
	return (
		<span
			className={cn(
				"inline-flex h-[18px] items-center rounded-full px-[7px] text-[11px] leading-none font-medium",
				tone === "new" ? "bg-brand-subtle text-brand-text" : "bg-cell text-text-muted",
			)}
		>
			{label}
		</span>
	)
}

function ProductMenuItem({ item }: { item: ProductNavItem }) {
	const Icon = productIcons[item.icon]
	const body = (
		<>
			<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-cell text-text-secondary">
				<Icon className="size-4" aria-hidden="true" />
			</span>
			<span className="grid flex-1 gap-0.5">
				<span className="flex items-center gap-2 text-[14px] leading-5 font-semibold">
					{item.label}
					{item.pill ? <Pill label={item.pill.label} tone={item.pill.tone} /> : null}
				</span>
				<span className="text-[12px] leading-[18px] text-text-muted">{item.description}</span>
			</span>
		</>
	)

	if (!item.href) {
		return (
			<DropdownMenuItem className={cn(panelItemClass, "gap-3")} disabled>
				{body}
			</DropdownMenuItem>
		)
	}

	return (
		<DropdownMenuItem className={cn(panelItemClass, "gap-3")} asChild>
			<a
				href={item.href}
				onClick={() => trackEvent({ name: "nav_clicked", item: item.label, surface: "header" })}
			>
				{body}
				<ArrowUpRight className={hoverArrowClass} aria-hidden="true" />
			</a>
		</DropdownMenuItem>
	)
}

function ProductMenu({ isCurrent }: { isCurrent: boolean }) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger className={navLinkClass} data-current={isCurrent || undefined}>
				Product
				<ChevronDown
					className="size-3.5 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
					aria-hidden="true"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className={cn(panelClass, "grid w-[820px] grid-cols-[1.1fr_1fr_1fr] gap-1")}
				align="start"
				alignOffset={-160}
				sideOffset={8}
			>
				<DropdownMenuItem
					className="group row-span-2 flex cursor-default flex-col items-start gap-2 rounded-[10px] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--accent)_9%,transparent),transparent_70%)] p-4 text-text-primary focus:bg-[linear-gradient(160deg,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)]"
					asChild
				>
					<a href={productFeature.href}>
						<Pill label={productFeature.pill} tone="new" />
						<span className="text-[16px] leading-[22px] font-semibold">{productFeature.title}</span>
						<span className="text-[13px] leading-[19px] text-text-secondary">
							{productFeature.description}
						</span>
						<span className="mt-auto inline-flex items-center gap-1.5 text-[13px] leading-none font-medium">
							{productFeature.cta}
							<ArrowUpRight
								className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
								aria-hidden="true"
							/>
						</span>
					</a>
				</DropdownMenuItem>
				{productNavGroups.map((group) => (
					<DropdownMenuGroup key={group.title} aria-label={group.title}>
						<DropdownMenuLabel className="mx-3 mt-2 mb-1 p-0 text-[12px] leading-4 font-semibold text-text-muted">
							{group.title}
						</DropdownMenuLabel>
						{group.items.map((item) => (
							<ProductMenuItem key={item.label} item={item} />
						))}
					</DropdownMenuGroup>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function ResourcesMenu({ pathname }: { pathname: string }) {
	const isCurrent = resourceNavLinks.some((link) => isCurrentPath(pathname, link.href))

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger className={navLinkClass} data-current={isCurrent || undefined}>
				Resources
				<ChevronDown
					className="size-3.5 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
					aria-hidden="true"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className={cn(panelClass, "grid w-[340px] gap-1")}
				align="center"
				sideOffset={8}
			>
				{resourceNavLinks.map((link) => (
					<DropdownMenuItem key={link.href} className={cn(panelItemClass, "grid gap-1")} asChild>
						<a
							href={link.href}
							aria-current={isCurrentPath(pathname, link.href) ? "page" : undefined}
							onClick={() =>
								trackEvent({ name: "nav_clicked", item: link.label, surface: "header" })
							}
						>
							<span className="flex items-center justify-between gap-4 text-[14px] leading-5 font-semibold">
								{link.label}
								<ArrowUpRight className={hoverArrowClass} aria-hidden="true" />
							</span>
							<span className="max-w-[260px] text-[12px] leading-5 text-text-muted">
								{link.description}
							</span>
						</a>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function AccountLink({
	session,
	surface,
}: {
	session: HeaderSession
	surface: "header" | "sheet"
}) {
	if (session.status === "signedIn") {
		return (
			<a
				className={cn(
					"inline-flex min-h-9 items-center gap-2 rounded-lg pr-1 pl-3 text-[13px] leading-none font-medium text-text-primary hover:bg-site-hover",
					surface === "sheet" &&
						"h-11 justify-center text-[15px] shadow-[inset_0_0_0_1px_var(--site-sep)]",
					focusRing,
				)}
				href={headerActions.account.href}
				onClick={() => trackEvent({ name: "account_clicked", location: surface })}
			>
				{headerActions.account.label}
				<span
					className="inline-flex size-[26px] items-center justify-center rounded-full bg-brand text-[10px] leading-none font-semibold text-text-on-accent"
					aria-hidden="true"
				>
					{getAccountInitial(session.email)}
				</span>
			</a>
		)
	}

	return (
		<a
			className={cn(
				"inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-[13px] leading-none font-medium text-text-primary hover:bg-site-hover",
				surface === "sheet" &&
					"h-11 justify-center text-[15px] shadow-[inset_0_0_0_1px_var(--site-sep)]",
				focusRing,
			)}
			href={headerActions.signIn.href}
			onClick={() => trackEvent({ name: "login_clicked", location: surface })}
		>
			{headerActions.signIn.label}
		</a>
	)
}

function DownloadLink({ className, surface }: { className?: string; surface: "header" | "sheet" }) {
	return (
		<a
			className={cn(
				"inline-flex h-8 items-center justify-center rounded-lg bg-brand px-4 text-[13px] leading-none font-medium text-primary-foreground shadow-[var(--shadow-primary,0_1px_2px_rgba(0,0,0,0.18))] transition-[background-color,scale] duration-150 ease-out hover:bg-brand-hover active:scale-[0.96] motion-reduce:active:scale-100",
				focusRing,
				className,
			)}
			href={headerActions.download.href}
			onClick={() => trackEvent({ name: "nav_clicked", item: "Download", surface })}
		>
			{headerActions.download.label}
		</a>
	)
}

function MobileNavigation({ session }: { session: HeaderSession }) {
	const [isOpen, setIsOpen] = useState(false)
	const sheetLinkClass = cn(
		"flex min-h-12 items-center justify-between gap-2 border-sep border-b px-1 text-[16px] leading-none font-semibold text-text-primary",
		focusRing,
	)

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				className={cn(
					"hidden size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-site-hover hover:text-text-primary max-[1000px]:inline-flex",
					focusRing,
				)}
				aria-label={isOpen ? "Close navigation" : "Open navigation"}
			>
				{isOpen ? (
					<X className="size-4" aria-hidden="true" />
				) : (
					<Menu className="size-4" aria-hidden="true" />
				)}
			</SheetTrigger>
			<SheetContent
				side="top"
				showCloseButton={false}
				className="top-[76px] right-3 left-3 grid max-h-[calc(100dvh-96px)] gap-1 overflow-auto rounded-[14px] border-0 bg-site-panel p-4 text-text-primary shadow-panel backdrop-blur-none max-sm:top-[68px] max-sm:right-2 max-sm:left-2"
			>
				<div>
					<SheetTitle className="text-[17px] leading-[1.3] font-semibold">
						Explore Cortex
					</SheetTitle>
					<SheetDescription className="mt-1 text-[13px] leading-[1.45] text-text-muted">
						{siteTagline}
					</SheetDescription>
				</div>
				<div className="mt-2 flex items-center justify-between border-sep border-b py-1.5 text-[14px] leading-none font-semibold">
					<span>Theme</span>
					<ThemeToggle />
				</div>
				<nav className="grid" aria-label="Mobile navigation">
					{mobileNavLinks.map((link) =>
						link.href ? (
							<SheetClose key={link.label} asChild>
								<a
									className={sheetLinkClass}
									href={link.href}
									onClick={() =>
										trackEvent({ name: "nav_clicked", item: link.label, surface: "sheet" })
									}
								>
									{link.label}
									{link.pill ? <Pill label={link.pill} tone="soon" /> : null}
								</a>
							</SheetClose>
						) : (
							<span key={link.label} className={cn(sheetLinkClass, "text-text-muted")}>
								{link.label}
								{link.pill ? <Pill label={link.pill} tone="soon" /> : null}
							</span>
						),
					)}
					<h2 className="mx-1 mt-4 mb-0.5 text-[12px] leading-4 font-semibold text-text-muted">
						Resources
					</h2>
					{resourceNavLinks.map((link) => (
						<SheetClose key={link.href} asChild>
							<a
								className={sheetLinkClass}
								href={link.href}
								onClick={() =>
									trackEvent({ name: "nav_clicked", item: link.label, surface: "sheet" })
								}
							>
								{link.label}
							</a>
						</SheetClose>
					))}
					<SheetClose asChild>
						<a
							className={sheetLinkClass}
							href={siteConfig.githubUrl}
							target="_blank"
							rel="noreferrer"
							onClick={() => trackEvent({ name: "github_clicked", location: "sheet" })}
						>
							GitHub
							<ArrowUpRight className="size-4 text-text-muted" aria-hidden="true" />
						</a>
					</SheetClose>
				</nav>
				<div className="mt-3.5 grid grid-cols-2 gap-2">
					<DownloadLink className="h-11 text-[15px]" surface="sheet" />
					<AccountLink session={session} surface="sheet" />
				</div>
			</SheetContent>
		</Sheet>
	)
}

export function SiteHeader({ sessionLoader = loadHeaderSession }: SiteHeaderProps) {
	const pathname = useRouterState({ select: (state) => state.location.pathname })
	const session = useHeaderSession(sessionLoader)
	const isProductMenuPath = ["/mobile", "/cli"].some((href) => isCurrentPath(pathname, href))

	return (
		<header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 max-sm:px-2 max-sm:pt-2">
			<div className="pointer-events-auto relative mx-auto flex h-14 w-[min(1040px,calc(100%-24px))] items-center gap-2 rounded-xl bg-site-glass px-3 text-left shadow-glass backdrop-blur-[24px] backdrop-saturate-[1.4] max-[1000px]:justify-between max-sm:h-[52px] max-sm:w-full max-sm:px-2">
				<a
					className={cn(
						"inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-[16px] leading-none font-semibold tracking-[-0.01em] text-text-primary",
						focusRing,
					)}
					href="/"
					aria-label="Cortex home"
				>
					<CortexMark className="size-[30px]" />
					Cortex
				</a>

				<nav
					className="mx-auto flex items-center gap-0.5 max-[1000px]:hidden"
					aria-label="Primary navigation"
				>
					<ProductMenu isCurrent={isProductMenuPath} />
					{primaryNavLinks.map((link) => {
						const isCurrent = isCurrentPath(pathname, link.href)
						return (
							<a
								key={link.href}
								className={navLinkClass}
								href={link.href}
								aria-current={isCurrent ? "page" : undefined}
								onClick={() =>
									trackEvent({ name: "nav_clicked", item: link.label, surface: "header" })
								}
							>
								{link.label}
							</a>
						)
					})}
					<span className="mx-1 h-5 w-px bg-sep" aria-hidden="true" />
					<ResourcesMenu pathname={pathname} />
					<a
						className={navLinkClass}
						href={siteConfig.githubUrl}
						target="_blank"
						rel="noreferrer"
						onClick={() => trackEvent({ name: "github_clicked", location: "header" })}
					>
						GitHub
					</a>
				</nav>

				<div className="flex shrink-0 items-center gap-1 max-[1000px]:ml-auto">
					<ThemeToggle className="max-[1000px]:hidden" />
					<span className="max-[1000px]:hidden">
						<AccountLink session={session} surface="header" />
					</span>
					<DownloadLink className="max-sm:hidden" surface="header" />
					<MobileNavigation session={session} />
				</div>
			</div>
		</header>
	)
}
