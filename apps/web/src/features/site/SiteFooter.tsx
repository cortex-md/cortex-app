import { siteConfig } from "../../config/site"
import {
	type FooterLinkItem,
	footerCopyright,
	footerLinkGroups,
	footerSocialLinks,
	siteTagline,
} from "../../content/site"
import { trackEvent } from "../../lib/analytics"
import { CortexMark } from "./CortexMark"

const footerLinkClass =
	"rounded-md text-[14px] leading-5 font-medium text-white/[0.82] outline-none transition-colors duration-150 ease-out hover:text-white focus-visible:shadow-focus"

function FooterLink({ link }: { link: FooterLinkItem }) {
	if (!link.href) {
		return (
			<span className="inline-flex items-center gap-2 text-[14px] leading-5 font-medium text-white/50">
				{link.label}
				<span className="inline-flex h-[18px] items-center rounded-full bg-white/10 px-[7px] text-[11px] leading-none font-medium text-white/60">
					Soon
				</span>
			</span>
		)
	}

	const isExternal = link.href.startsWith("http")
	const isGitHub = link.href.startsWith(siteConfig.githubUrl)

	return (
		<a
			className={footerLinkClass}
			href={link.href}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noreferrer" : undefined}
			onClick={() =>
				isGitHub
					? trackEvent({ name: "github_clicked", location: "footer" })
					: trackEvent({ name: "nav_clicked", item: link.label, surface: "footer" })
			}
		>
			{link.label}
		</a>
	)
}

export function SiteFooter() {
	return (
		<footer className="mt-[140px] bg-site-footer py-20 text-left text-white max-sm:mt-24 max-sm:pt-16 max-sm:pb-14">
			<div className="mx-auto grid w-[min(1180px,calc(100%-64px))] grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)] gap-16 max-[1000px]:grid-cols-1 max-[1000px]:gap-12 max-sm:w-[calc(100%-40px)]">
				<div>
					<a
						className="inline-flex items-center gap-3 rounded-md text-[20px] leading-none font-semibold tracking-[-0.01em] text-white outline-none focus-visible:shadow-focus"
						href="/"
					>
						<CortexMark className="size-8" size={32} />
						Cortex
					</a>
					<p className="mt-4 max-w-[260px] text-[14px] leading-[1.55] text-white/60">
						{siteTagline}
					</p>
					<h2 className="mt-10 mb-4 text-[14px] leading-5 font-semibold text-white/[0.48] max-sm:mt-8">
						Follow us
					</h2>
					<ul className="grid gap-3">
						{footerSocialLinks.map((link) => (
							<li key={link.label}>
								<FooterLink link={link} />
							</li>
						))}
					</ul>
					<p className="mt-8 text-[14px] leading-5 font-medium text-white/50">{footerCopyright}</p>
				</div>
				<div className="grid grid-cols-4 gap-x-12 gap-y-14 max-sm:grid-cols-2 max-sm:gap-x-6 max-sm:gap-y-10">
					{footerLinkGroups.map((group) => (
						<nav key={group.title} className="min-w-0" aria-label={`${group.title} links`}>
							<h2 className="mb-4 text-[14px] leading-5 font-semibold text-white/[0.48]">
								{group.title}
							</h2>
							<ul className="grid gap-3">
								{group.links.map((link) => (
									<li key={link.label}>
										<FooterLink link={link} />
									</li>
								))}
							</ul>
						</nav>
					))}
				</div>
			</div>
		</footer>
	)
}
