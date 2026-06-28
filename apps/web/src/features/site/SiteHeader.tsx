import { Button } from "@cortex/ui/button"
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@cortex/ui/sheet"
import { ArrowUpRight, ChevronDown, Menu } from "lucide-react"
import { type FocusEvent, useEffect, useRef, useState } from "react"
import { landingNavigation, siteConfig, siteResourceLinks } from "../../config/site"
import { trackLandingEvent } from "../../lib/analytics"
import { type AuthSessionResult, getSession } from "../../server/auth"
import { ThemeToggle } from "./ThemeToggle"

interface SiteHeaderProps {
	homeHrefPrefix?: "" | "/"
	sessionLoader?: () => Promise<AuthSessionResult>
	surface?: "landing" | "docs" | "changelog" | "roadmap" | "billing"
}

interface HeaderAuthAction {
	eventName: "account_clicked" | "login_clicked"
	href: string
	label: string
}

function resolveHref(href: string, homeHrefPrefix: "" | "/") {
	if (href.startsWith("#")) return `${homeHrefPrefix}${href}`
	return href
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ")
}

function ResourcePanelLink({
	description,
	href,
	isOpen,
	label,
}: {
	description: string
	href: string
	isOpen: boolean
	label: string
}) {
	return (
		<a
			className="group grid rounded-lg px-3 py-2.5 text-left transition-[background-color,color] duration-150 ease-out hover:bg-bg-secondary focus-visible:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
			href={href}
			tabIndex={isOpen ? 0 : -1}
		>
			<span className="flex items-center justify-between gap-4 text-[14px] leading-5 font-semibold text-text-primary">
				{label}
				<ArrowUpRight
					className="size-3.5 scale-[0.25] opacity-0 blur-[4px] transition-[opacity,scale,filter] duration-200 ease-out group-hover:scale-100 group-hover:opacity-70 group-hover:blur-0 group-focus-visible:scale-100 group-focus-visible:opacity-70 group-focus-visible:blur-0"
					aria-hidden="true"
				/>
			</span>
			<span className="mt-1 max-w-[260px] text-pretty text-[12px] leading-5 text-text-muted">
				{description}
			</span>
		</a>
	)
}

function ResourcesMenu({ homeHrefPrefix }: { homeHrefPrefix: "" | "/" }) {
	const [isOpen, setIsOpen] = useState(false)
	const closeTimerRef = useRef<number | undefined>(undefined)
	const containerRef = useRef<HTMLElement | null>(null)
	const ignoreNextFocusRef = useRef(false)

	function clearCloseTimer() {
		if (closeTimerRef.current === undefined) return
		window.clearTimeout(closeTimerRef.current)
		closeTimerRef.current = undefined
	}

	function openMenu() {
		if (ignoreNextFocusRef.current) {
			ignoreNextFocusRef.current = false
			return
		}
		clearCloseTimer()
		setIsOpen(true)
	}

	function closeMenu() {
		clearCloseTimer()
		setIsOpen(false)
	}

	function scheduleCloseMenu() {
		clearCloseTimer()
		closeTimerRef.current = window.setTimeout(() => {
			setIsOpen(false)
			closeTimerRef.current = undefined
		}, 120)
	}

	useEffect(() => {
		return () => {
			if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current)
		}
	}, [])

	function closeIfFocusLeaves(event: FocusEvent<HTMLElement>) {
		if (!containerRef.current?.contains(event.relatedTarget)) closeMenu()
	}

	return (
		<section
			className="relative"
			ref={containerRef}
			aria-label="Resources"
			onPointerEnter={openMenu}
			onPointerLeave={scheduleCloseMenu}
			onFocus={openMenu}
			onBlur={closeIfFocusLeaves}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					ignoreNextFocusRef.current = true
					closeMenu()
					const trigger = event.currentTarget.querySelector("button")
					if (trigger instanceof HTMLButtonElement) trigger.focus()
					window.setTimeout(() => {
						ignoreNextFocusRef.current = false
					}, 0)
				}
			}}
		>
			<button
				className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-text-secondary transition-[background-color,color] duration-150 ease-out hover:bg-bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none data-[open=true]:bg-bg-secondary data-[open=true]:text-foreground"
				type="button"
				aria-expanded={isOpen}
				aria-haspopup="true"
				data-open={isOpen}
			>
				Resources
				<ChevronDown
					className={joinClasses(
						"size-3.5 transition-[rotate] duration-200 ease-out",
						isOpen && "rotate-180",
					)}
					aria-hidden="true"
				/>
			</button>
			<section
				className={joinClasses(
					"absolute top-full left-1/2 z-50 w-[340px] -translate-x-1/2 pt-2",
					isOpen ? "pointer-events-auto" : "pointer-events-none",
				)}
				aria-hidden={!isOpen}
				aria-label="Resources menu"
			>
				<div
					className={joinClasses(
						"rounded-xl p-2 text-text-primary backdrop-blur-xl transition-[opacity,transform,filter] duration-200 ease-out [background:var(--site-panel-glass)] [box-shadow:var(--site-panel-shadow)]",
						isOpen
							? "translate-y-0 scale-100 opacity-100 blur-0"
							: "-translate-y-2 scale-[0.98] opacity-0 blur-[4px]",
					)}
				>
					<div className="grid gap-1">
						{siteResourceLinks.map((item) => (
							<ResourcePanelLink
								description={item.description}
								href={resolveHref(item.href, homeHrefPrefix)}
								isOpen={isOpen}
								key={item.href}
								label={item.label}
							/>
						))}
					</div>
				</div>
			</section>
		</section>
	)
}

function useHeaderAuthAction(sessionLoader: () => Promise<AuthSessionResult>): HeaderAuthAction {
	const [authAction, setAuthAction] = useState<HeaderAuthAction>({
		eventName: "login_clicked",
		href: "/login?redirect=/account",
		label: "Login",
	})

	useEffect(() => {
		let isMounted = true

		void sessionLoader()
			.then((session) => {
				if (!isMounted) return
				setAuthAction(
					session.authenticated
						? {
								eventName: "account_clicked",
								href: "/account",
								label: "Account",
							}
						: {
								eventName: "login_clicked",
								href: "/login?redirect=/account",
								label: "Login",
							},
				)
			})
			.catch(() => {
				if (!isMounted) return
				setAuthAction({
					eventName: "login_clicked",
					href: "/login?redirect=/account",
					label: "Login",
				})
			})

		return () => {
			isMounted = false
		}
	}, [sessionLoader])

	return authAction
}

function loadHeaderSession() {
	return getSession()
}

export function SiteHeader({
	homeHrefPrefix = "",
	sessionLoader = loadHeaderSession,
	surface = "landing",
}: SiteHeaderProps) {
	const authAction = useHeaderAuthAction(sessionLoader)
	const surfaceLabel = surface === "landing" ? "Primary navigation" : "Site navigation"

	return (
		<header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 max-sm:top-2">
			<div
				className="pointer-events-auto mx-auto flex h-14 w-[min(1040px,calc(100%_-_24px))] items-center gap-2 rounded-xl px-3 backdrop-blur-xl [background:var(--site-header-glass)] [box-shadow:var(--site-header-shadow)] max-lg:w-[min(900px,calc(100%_-_20px))] max-sm:h-[52px] max-sm:w-full max-sm:px-2"
				data-glass-nav=""
				data-site-header-surface={surface}
			>
				<a
					className="inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-[16px] font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
					href="/"
					aria-label="Cortex home"
				>
					<img className="block rounded-lg" src="/icon-192.png" width={30} height={30} alt="" />
					<span>Cortex</span>
				</a>

				<nav className="mx-auto flex items-center gap-0.5 max-lg:hidden" aria-label={surfaceLabel}>
					{landingNavigation.map((item) => (
						<a
							className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-text-secondary transition-[background-color,color] duration-150 ease-out hover:bg-bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
							key={item.href}
							href={resolveHref(item.href, homeHrefPrefix)}
						>
							{item.label}
						</a>
					))}
					<span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden="true" />
					<ResourcesMenu homeHrefPrefix={homeHrefPrefix} />
					<a
						className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-text-secondary transition-[background-color,color] duration-150 ease-out hover:bg-bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
						href={siteConfig.githubUrl}
						target="_blank"
						rel="noreferrer"
						onClick={() => trackLandingEvent({ name: "github_clicked", location: "header" })}
					>
						GitHub
					</a>
				</nav>

				<div className="ml-auto flex items-center gap-1">
					<ThemeToggle className="max-lg:hidden" />
					<Button
						className="bg-[#303342] px-4 text-white shadow-[0_1px_2px_rgba(17,19,26,0.14)] tracking-normal transition-[background-color,scale] duration-150 ease-out hover:bg-[#1f222c] active:scale-[0.96] max-sm:hidden"
						size="sm"
						onClick={() => trackLandingEvent({ name: authAction.eventName, location: "header" })}
						asChild
					>
						<a href={authAction.href}>{authAction.label}</a>
					</Button>

					<Sheet>
						<SheetTrigger asChild>
							<Button
								className="hidden hover:bg-bg-secondary max-lg:inline-flex"
								variant="ghost"
								size="icon-sm"
								aria-label="Open navigation"
							>
								<Menu aria-hidden="true" />
							</Button>
						</SheetTrigger>
						<SheetContent className="bg-card/95 text-card-foreground">
							<SheetHeader>
								<SheetTitle>Explore Cortex</SheetTitle>
								<SheetDescription>
									A local-first Markdown workspace built in the open.
								</SheetDescription>
							</SheetHeader>
							<div className="px-4">
								<div className="flex items-center justify-between border-border border-b py-3">
									<span className="text-sm font-semibold text-text-primary">Theme</span>
									<ThemeToggle />
								</div>
							</div>
							<nav className="grid gap-1 px-4 py-2" aria-label="Mobile navigation">
								{landingNavigation.map((item) => (
									<SheetClose key={item.href} asChild>
										<a
											className="flex items-center justify-between border-border border-b px-2.5 py-3 text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
											href={resolveHref(item.href, homeHrefPrefix)}
										>
											{item.label}
										</a>
									</SheetClose>
								))}
								<div className="pt-3 pb-1 text-[12px] leading-4 font-semibold text-text-muted">
									Resources
								</div>
								{siteResourceLinks.map((item) => (
									<SheetClose key={item.href} asChild>
										<a
											className="grid border-border border-b px-2.5 py-3 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
											href={resolveHref(item.href, homeHrefPrefix)}
										>
											<span className="text-base font-semibold">{item.label}</span>
											<span className="mt-1 text-sm leading-5 text-text-muted">
												{item.description}
											</span>
										</a>
									</SheetClose>
								))}
								<SheetClose asChild>
									<a
										className="flex items-center justify-between border-border border-b px-2.5 py-3 text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
										href={authAction.href}
										onClick={() =>
											trackLandingEvent({
												name: authAction.eventName,
												location: "header_mobile",
											})
										}
									>
										{authAction.label}
									</a>
								</SheetClose>
								<SheetClose asChild>
									<a
										className="flex items-center justify-between border-border border-b px-2.5 py-3 text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
										href={siteConfig.githubUrl}
										target="_blank"
										rel="noreferrer"
										onClick={() =>
											trackLandingEvent({
												name: "github_clicked",
												location: "header",
											})
										}
									>
										GitHub
										<ArrowUpRight aria-hidden="true" />
									</a>
								</SheetClose>
							</nav>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	)
}
