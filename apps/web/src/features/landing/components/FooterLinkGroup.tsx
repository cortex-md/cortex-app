import type { footerLinkGroups } from "../../../content/landing"

type FooterLink = (typeof footerLinkGroups)[number]["links"][number]

export interface FooterLinkGroupData {
	title: string
	links: readonly FooterLink[]
}

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
