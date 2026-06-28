import { ArrowUpRight } from "lucide-react"
import type { ChangelogRelease, ChangelogResult } from "../../server/changelog"
import { LandingFooter } from "../landing/sections/LandingFooter"
import { SiteHeader } from "../site/SiteHeader"

interface ChangelogPageProps {
	changelog: ChangelogResult
}

function ChangelogIntro({ changelog }: { changelog: ChangelogResult }) {
	const releaseCount = changelog.releases.length
	const releaseLabel = releaseCount === 1 ? "1 stable release" : `${releaseCount} stable releases`

	return (
		<section className="border-border-subtle border-t pt-16 pb-14 max-md:pt-12 max-md:pb-10">
			<div className="grid max-w-[780px] gap-4">
				<p className="m-0 text-[15px] leading-6 font-medium text-text-muted">Changelog</p>
				<h1 className="m-0 max-w-[720px] text-balance text-[clamp(38px,5vw,64px)] leading-[1.02] font-medium tracking-[-0.025em] text-text-primary">
					Product changes, written from the release notes.
				</h1>
				<p className="m-0 max-w-[620px] text-pretty text-[16px] leading-7 text-text-secondary">
					Stable public Cortex desktop releases from GitHub, rendered with the same Markdown preview
					surface used in the docs.
				</p>
				<p className="m-0 text-[13px] leading-5 font-medium text-text-muted">
					{changelog.status === "ok" ? releaseLabel : changelog.message}
					{changelog.isStale ? " Cached." : ""}
				</p>
			</div>
		</section>
	)
}

function ReleaseMeta({ release }: { release: ChangelogRelease }) {
	return (
		<div className="sticky top-[112px] flex items-center gap-3 self-start text-[15px] leading-6 text-text-muted max-md:static">
			<span className="inline-flex min-h-7 items-center rounded-full border border-border-strong px-2.5 text-[13px] leading-none font-medium text-text-secondary tabular-nums">
				{release.version}
			</span>
			<time dateTime={release.publishedAt}>{release.formattedDate}</time>
		</div>
	)
}

function ChangelogMarkdown({ html }: { html: string }) {
	return (
		<div
			className="markdown-surface docs-markdown changelog-markdown"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: release markdown is rendered and hardened server-side
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	)
}

function ChangelogReleaseArticle({ release }: { release: ChangelogRelease }) {
	return (
		<article className="grid grid-cols-[220px_minmax(0,720px)] gap-[104px] border-border-subtle border-t py-20 max-lg:grid-cols-[180px_minmax(0,1fr)] max-lg:gap-14 max-md:grid-cols-1 max-md:gap-6 max-md:py-14">
			<ReleaseMeta release={release} />
			<div className="min-w-0">
				<p className="mb-3 text-[15px] leading-6 font-medium text-text-muted">Changelog</p>
				<h2 className="m-0 max-w-[760px] text-balance text-[clamp(34px,4.2vw,50px)] leading-[1.08] font-medium tracking-[-0.022em] text-text-primary">
					{release.title}
				</h2>
				<div className="mt-9">
					<ChangelogMarkdown html={release.bodyHtml} />
				</div>
				<a
					className="mt-10 inline-flex min-h-10 items-center gap-1 rounded-lg text-[14px] font-medium text-text-muted transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
					href={release.url}
					target="_blank"
					rel="noreferrer"
				>
					View on GitHub
					<ArrowUpRight className="size-4" aria-hidden="true" />
				</a>
			</div>
		</article>
	)
}

function ChangelogEmptyState({ status, message }: Pick<ChangelogResult, "status" | "message">) {
	const isUnavailable = status === "unavailable"

	return (
		<section className="grid grid-cols-[220px_minmax(0,720px)] gap-[104px] border-border-subtle border-t py-20 max-lg:grid-cols-[180px_minmax(0,1fr)] max-lg:gap-14 max-md:grid-cols-1 max-md:gap-6 max-md:py-14">
			<div className="sticky top-[112px] self-start text-[15px] leading-6 text-text-muted max-md:static">
				Stable releases
			</div>
			<div className="max-w-[620px]">
				<h2 className="m-0 text-balance text-[clamp(30px,3vw,42px)] leading-[1.1] font-medium tracking-[-0.018em] text-text-primary">
					{isUnavailable
						? "Release notes are temporarily unavailable."
						: "No public stable release notes yet."}
				</h2>
				<p className="mt-5 text-pretty text-[16px] leading-7 text-text-secondary">
					{isUnavailable
						? "We could not reach GitHub Releases. When cached release notes exist, Cortex will keep showing them here while GitHub is unavailable."
						: message}
				</p>
				<a
					className="mt-8 inline-flex min-h-10 items-center rounded-lg text-[14px] font-medium text-text-secondary transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
					href="/docs"
				>
					Read the docs
				</a>
			</div>
		</section>
	)
}

export function ChangelogPage({ changelog }: ChangelogPageProps) {
	return (
		<div className="changelog-shell min-h-screen bg-bg-primary text-text-primary">
			<SiteHeader homeHrefPrefix="/" surface="changelog" />
			<main id="main-content" tabIndex={-1}>
				<div className="mx-auto w-[min(1180px,calc(100%_-_64px))] pt-30 max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-md:pt-26 max-sm:w-[min(calc(100%_-_28px),520px)]">
					<ChangelogIntro changelog={changelog} />
					{changelog.releases.length > 0 ? (
						<div>
							{changelog.releases.map((release) => (
								<ChangelogReleaseArticle key={release.tagName} release={release} />
							))}
						</div>
					) : (
						<ChangelogEmptyState status={changelog.status} message={changelog.message} />
					)}
				</div>
			</main>
			<LandingFooter homeHrefPrefix="/" />
		</div>
	)
}
