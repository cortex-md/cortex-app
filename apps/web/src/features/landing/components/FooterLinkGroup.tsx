import { Badge } from "@cortex/ui/badge"
import type { footerLinkGroups } from "../../../content/landing"

type FooterLinkGroupData = (typeof footerLinkGroups)[number]

interface FooterLinkGroupProps {
	group: FooterLinkGroupData
	resolveHref: (href: string) => string
	onGitHubClick: () => void
}

export function FooterLinkGroup({ group, resolveHref, onGitHubClick }: FooterLinkGroupProps) {
	return (
		<nav aria-label={`${group.title} links`}>
			<h3 className="mb-4 text-sm font-semibold text-white/[0.48]">{group.title}</h3>
			<ul className="grid gap-3">
				{group.links.map((link) => {
					if ("soon" in link && link.soon) {
						return (
							<li className="flex items-center gap-2" key={link.label}>
								<span className="text-sm leading-5 font-medium text-white/[0.4]">{link.label}</span>
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
								className="rounded-md text-sm leading-5 font-medium text-white/[0.82] transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:outline-none"
								href={href}
								target={isExternal ? "_blank" : undefined}
								rel={isExternal ? "noreferrer" : undefined}
								onClick={link.href === "github" ? onGitHubClick : undefined}
							>
								{link.label}
							</a>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
