import { Badge } from "@cortex/ui/badge"
import { siteConfig } from "../../../config/site"
import { footerLinkGroups, footerSocialLinks } from "../../../content/landing"
import { trackLandingEvent } from "../../../lib/analytics"
import { FooterLinkGroup } from "../components/FooterLinkGroup"

interface LandingFooterProps {
	homeHrefPrefix?: "" | "/"
}

export function LandingFooter({ homeHrefPrefix = "" }: LandingFooterProps) {
	function resolveHref(href: string) {
		if (href === "github") return siteConfig.githubUrl
		if (href.startsWith("#")) return `${homeHrefPrefix}${href}`
		return href
	}

	return (
		<footer className="bg-[#0f0f0f] py-20 text-white max-md:py-[68px]">
			<div className="mx-auto grid w-[min(1180px,calc(100%_-_64px))] grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)] gap-16 max-lg:w-[min(calc(100%_-_48px),940px)] max-lg:grid-cols-1 max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)]">
				<div>
					<a
						className="inline-flex items-center gap-3 rounded-md text-xl font-semibold focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:outline-none"
						href="/"
					>
						<img className="size-8 rounded-lg" src="/icon-192.png" width={32} height={32} alt="" />
						<span>Cortex</span>
					</a>

					<div className="mt-10">
						<p className="mb-4 text-sm font-semibold text-white/[0.48]">Follow us</p>
						<ul className="grid max-w-[280px] grid-cols-2 gap-x-8 gap-y-2.5">
							{footerSocialLinks.map((link) => {
								if ("soon" in link && link.soon) {
									return (
										<li className="flex items-center gap-2" key={link.label}>
											<span className="text-sm font-medium text-white/[0.4]">{link.label}</span>
											<Badge
												className="border-white/[0.1] bg-white/[0.06] text-white/[0.45]"
												variant="outline"
											>
												Soon
											</Badge>
										</li>
									)
								}

								if (!("href" in link)) {
									return null
								}

								const href = resolveHref(link.href)
								const isExternal = href.startsWith("http")

								return (
									<li key={link.label}>
										<a
											className="rounded-md text-sm font-medium text-white/[0.82] transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:outline-none"
											href={href}
											target={isExternal ? "_blank" : undefined}
											rel={isExternal ? "noreferrer" : undefined}
											onClick={
												link.href === "github"
													? () => trackLandingEvent({ name: "github_clicked", location: "footer" })
													: undefined
											}
										>
											{link.label}
										</a>
									</li>
								)
							})}
						</ul>
					</div>

					<p className="mt-8 text-sm font-medium text-white/[0.45]">© 2026 Cortex</p>
				</div>

				<div className="grid grid-cols-3 gap-x-16 gap-y-14 max-md:grid-cols-2 max-sm:grid-cols-1">
					{footerLinkGroups.map((group) => (
						<FooterLinkGroup
							key={group.title}
							group={group}
							resolveHref={resolveHref}
							onGitHubClick={() =>
								trackLandingEvent({ name: "github_clicked", location: "footer" })
							}
						/>
					))}
				</div>
			</div>
		</footer>
	)
}
