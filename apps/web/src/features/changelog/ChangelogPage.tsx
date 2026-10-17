import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { ArrowUpRight, Check, Download, Github, Rss, Sparkles } from "lucide-react"
import { useState } from "react"
import {
	type ChangelogFilter,
	changelogCopy,
	changelogFilters,
	changelogLinks,
	downloadPlatformLabels,
} from "../../content/changelog"
import { trackEvent } from "../../lib/analytics"
import type {
	ChangelogRelease,
	ChangelogResult,
	ReleaseDownload,
	ReleaseNoteGroup,
} from "../../server/changelog"
import { RenderedMarkdown } from "../docs/components/RenderedMarkdown"

interface ChangelogPageProps {
	changelog: ChangelogResult
}

const focusRing = "outline-none focus-visible:shadow-focus"
const pillBase =
	"inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] leading-none font-medium"

function getDownloadDetail(download: ReleaseDownload) {
	const fileName = download.fileName.toLowerCase()
	if (download.platform === "macos") {
		return /aarch64|arm64/u.test(fileName) ? "Apple Silicon · .dmg" : ".dmg"
	}
	if (download.platform === "windows") return /x64|amd64/u.test(fileName) ? "x64 · .msi" : ".msi"
	if (download.platform === "debian") return ".deb"
	return "AppImage"
}

function splitNote(text: string) {
	const match = text.match(/^(.{3,48}?)\s+[—–-]\s+(.+)$/u)
	if (!match?.[1] || !match[2]) return null
	return { title: match[1], description: match[2] }
}

function getVisibleGroups(release: ChangelogRelease, filter: ChangelogFilter) {
	const groups = release.notes?.groups ?? []
	if (filter === "New") return groups.filter((group) => group.kind === "new")
	if (filter === "Fixed") return groups.filter((group) => group.kind === "fixed")
	return groups
}

function NewNotes({ group }: { group: ReleaseNoteGroup }) {
	const isShortList = group.items.every((item) => item.length <= 40)

	return (
		<>
			<h3 className="mt-7 mb-3">
				<span className={cn(pillBase, "bg-brand-subtle text-brand-text")}>
					{changelogCopy.newLabel}
				</span>
			</h3>
			{isShortList ? (
				<ul className="flex flex-wrap gap-1.5">
					{group.items.map((item) => (
						<li
							key={item}
							className="rounded-full bg-cell px-[11px] py-[7px] text-[13px] leading-none font-medium text-text-primary"
						>
							{item}
						</li>
					))}
				</ul>
			) : (
				<ul className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
					{group.items.map((item) => {
						const parts = splitNote(item)
						return (
							<li key={item} className="flex gap-3 rounded-[14px] bg-bg-elevated p-3.5 shadow-ring">
								<span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-brand-text">
									<Sparkles className="size-[17px]" aria-hidden="true" />
								</span>
								<div className="min-w-0">
									{parts ? (
										<>
											<b className="text-[14.5px] leading-[1.3] font-semibold text-text-primary">
												{parts.title}
											</b>
											<p className="mt-1 text-[13.5px] leading-normal text-text-secondary">
												{parts.description}
											</p>
										</>
									) : (
										<p className="text-[13.5px] leading-normal text-text-secondary">{item}</p>
									)}
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</>
	)
}

function FixedNotes({ group }: { group: ReleaseNoteGroup }) {
	return (
		<>
			<h3 className="mt-7 mb-3">
				<span
					className={cn(pillBase, "bg-status-success-background text-status-success-foreground")}
				>
					{changelogCopy.fixedLabel}
				</span>
			</h3>
			<ul className="grid gap-2">
				{group.items.map((item) => (
					<li
						key={item}
						className="flex items-center gap-2.5 text-[15px] leading-normal text-text-primary"
					>
						<Check
							className="size-[15px] shrink-0 text-status-success-foreground"
							aria-hidden="true"
						/>
						{item}
					</li>
				))}
			</ul>
		</>
	)
}

function ReleaseDownloads({ downloads }: { downloads: ReleaseDownload[] }) {
	return (
		<>
			<h3 className="mt-7 mb-3 text-[13px] leading-none font-semibold text-text-muted">
				{changelogCopy.downloads}
			</h3>
			<ul className="grid grid-cols-4 gap-2 max-[1000px]:grid-cols-2">
				{downloads.map((download) => (
					<li key={download.url}>
						<a
							className={cn(
								"flex items-center gap-2.5 rounded-xl p-3 text-text-primary shadow-[inset_0_0_0_1px_var(--site-sep)] hover:bg-bg-hover",
								focusRing,
							)}
							href={download.url}
							rel="noreferrer"
							onClick={() =>
								trackEvent({
									name: "download_clicked",
									platform:
										download.platform === "macos"
											? "macos"
											: download.platform === "windows"
												? "windows"
												: "linux",
									location: "changelog",
								})
							}
						>
							<Download className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
							<span className="grid gap-[3px]">
								<b className="text-[13.5px] leading-[1.2] font-semibold">
									{downloadPlatformLabels[download.platform]}
								</b>
								<small className="text-[12px] leading-[1.2] text-text-muted">
									{getDownloadDetail(download)}
								</small>
							</span>
						</a>
					</li>
				))}
			</ul>
		</>
	)
}

function ReleaseEntry({
	release,
	filter,
	isLatest,
}: {
	release: ChangelogRelease
	filter: ChangelogFilter
	isLatest: boolean
}) {
	const groups = getVisibleGroups(release, filter)
	const hasStructuredNotes = Boolean(
		release.notes && (release.notes.intro.length || release.notes.groups.length),
	)
	const downloads = release.downloads ?? []

	return (
		<li className="grid grid-cols-[180px_1fr] gap-10 border-sep border-t py-12 first:border-t-0 max-sm:grid-cols-[minmax(0,1fr)] max-sm:gap-[18px] max-sm:py-9">
			<div className="sticky top-24 grid content-start justify-items-start gap-2.5 self-start max-sm:static max-sm:flex max-sm:flex-wrap max-sm:items-center">
				<a
					className={cn(
						"rounded-sm text-[28px] leading-none font-semibold tracking-[-0.03em] text-text-primary hover:text-brand-text max-sm:text-[24px]",
						focusRing,
					)}
					href={release.url}
					target="_blank"
					rel="noreferrer"
				>
					{release.tagName}
				</a>
				{isLatest ? (
					<span className="inline-flex h-[22px] items-center rounded-full bg-text-primary px-[9px] text-[11.5px] leading-none font-medium text-bg-primary">
						{changelogCopy.latest}
					</span>
				) : null}
				<time className="text-[13.5px] leading-none text-text-muted" dateTime={release.publishedAt}>
					{release.formattedDate}
				</time>
			</div>
			<div className="min-w-0">
				<h2 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.025em] max-sm:text-[22px]">
					{release.title}
				</h2>
				{hasStructuredNotes ? (
					<>
						{release.notes?.intro.map((paragraph) => (
							<p
								key={paragraph}
								className="mt-2.5 max-w-[620px] text-[16px] leading-[1.6] text-text-secondary"
							>
								{paragraph}
							</p>
						))}
						{groups.map((group) =>
							group.kind === "new" ? (
								<NewNotes key={group.kind} group={group} />
							) : (
								<FixedNotes key={group.kind} group={group} />
							),
						)}
					</>
				) : (
					<RenderedMarkdown
						className="markdown-surface docs-markdown mt-4"
						html={release.bodyHtml}
					/>
				)}
				{filter === "All" && downloads.length > 0 ? (
					<ReleaseDownloads downloads={downloads} />
				) : null}
				<a
					className={cn(
						"mt-[26px] inline-flex items-center gap-[5px] rounded-sm text-[13.5px] leading-none font-medium text-text-secondary hover:text-text-primary",
						focusRing,
					)}
					href={release.url}
					target="_blank"
					rel="noreferrer"
				>
					{changelogCopy.viewOnGitHub(release.tagName)}
					<ArrowUpRight className="size-[13px]" aria-hidden="true" />
				</a>
			</div>
		</li>
	)
}

function ChangelogEmptyState({ changelog }: ChangelogPageProps) {
	const isUnavailable = changelog.status === "unavailable"

	return (
		<section className="mt-12 flex flex-col items-start gap-3 rounded-[22px] p-8 shadow-[inset_0_0_0_1px_var(--site-sep)] max-sm:p-6">
			<h2 className="text-[20px] leading-[1.25] font-semibold tracking-[-0.015em]">
				{isUnavailable ? changelogCopy.unavailableTitle : changelogCopy.emptyTitle}
			</h2>
			<p className="text-[15px] leading-normal text-text-secondary">{changelog.message}</p>
			<div className="mt-2 flex flex-wrap gap-2.5 max-sm:w-full max-sm:flex-col">
				{isUnavailable ? (
					<Button onClick={() => window.location.reload()}>{changelogCopy.tryAgain}</Button>
				) : null}
				<Button variant="secondary" asChild>
					<a href="/docs/get-started/welcome">{changelogCopy.readDocs}</a>
				</Button>
			</div>
		</section>
	)
}

export function ChangelogPage({ changelog }: ChangelogPageProps) {
	const [filter, setFilter] = useState<ChangelogFilter>("All")
	const releases = changelog.releases.filter(
		(release) => filter === "All" || getVisibleGroups(release, filter).length > 0,
	)
	const latestTag = changelog.releases[0]?.tagName
	const linkClass = cn(
		"inline-flex min-h-10 items-center gap-1.5 rounded-sm text-[14px] leading-none font-medium text-text-secondary hover:text-text-primary",
		focusRing,
	)

	return (
		<div className="mx-auto w-[min(980px,calc(100%-64px))] pt-[72px] max-sm:w-[calc(100%-40px)] max-sm:pt-10">
			<header>
				<h1 className="max-w-[820px] text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em] max-sm:text-[38px]">
					{changelogCopy.title}
				</h1>
				<p className="mt-3.5 max-w-[620px] text-[17px] leading-[1.6] text-text-secondary max-sm:text-[16.5px]">
					{changelogCopy.lead}
				</p>
				<div className="mt-[26px] flex flex-wrap items-center gap-x-[18px] gap-y-2.5">
					<a
						className={linkClass}
						href={changelogLinks.feed}
						onClick={() => trackEvent({ name: "changelog_feed_clicked", feed: "rss" })}
					>
						<Rss className="size-[15px]" aria-hidden="true" />
						{changelogCopy.rss}
					</a>
					<a
						className={linkClass}
						href={changelogLinks.releases}
						target="_blank"
						rel="noreferrer"
						onClick={() => trackEvent({ name: "changelog_feed_clicked", feed: "watch" })}
					>
						<Github className="size-[15px]" aria-hidden="true" />
						{changelogCopy.watch}
					</a>
				</div>
			</header>

			{changelog.status === "ok" ? (
				<>
					{changelog.isStale ? (
						<output className="mt-8 block text-[13.5px] leading-normal text-text-muted">
							{changelog.message}
						</output>
					) : null}
					<fieldset className="min-w-0 border-0 p-0 mt-12 mb-2 flex gap-1.5 max-sm:-mr-5 max-sm:overflow-x-auto max-sm:pr-5 max-sm:[scrollbar-width:none]">
						<legend className="sr-only">{changelogCopy.filterLabel}</legend>
						{changelogFilters.map((option) => (
							<button
								key={option}
								type="button"
								className={cn(
									"h-8 shrink-0 rounded-full px-3 text-[13px] leading-none font-medium text-text-secondary shadow-[inset_0_0_0_1px_var(--site-sep)] hover:text-text-primary aria-pressed:bg-text-primary aria-pressed:text-bg-primary aria-pressed:shadow-none max-sm:h-10 max-sm:px-4",
									focusRing,
								)}
								aria-pressed={filter === option}
								onClick={() => setFilter(option)}
							>
								{option}
							</button>
						))}
					</fieldset>
					{releases.length > 0 ? (
						<ol>
							{releases.map((release) => (
								<ReleaseEntry
									key={release.tagName}
									release={release}
									filter={filter}
									isLatest={release.tagName === latestTag}
								/>
							))}
						</ol>
					) : (
						<p className="py-12 text-[15px] text-text-muted">{changelogCopy.filteredEmpty}</p>
					)}
				</>
			) : (
				<ChangelogEmptyState changelog={changelog} />
			)}
		</div>
	)
}
