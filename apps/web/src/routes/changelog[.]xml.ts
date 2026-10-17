import { createFileRoute } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { changelogCopy } from "../content/changelog"
import { type ChangelogRelease, fetchCachedChangelogReleases } from "../server/changelog"

function escapeXml(value: string) {
	return value
		.replace(/&/gu, "&amp;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;")
		.replace(/"/gu, "&quot;")
		.replace(/'/gu, "&apos;")
}

function toCdata(value: string) {
	return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`
}

function createItem(release: ChangelogRelease) {
	return [
		"<item>",
		`<title>${escapeXml(`${release.tagName} — ${release.title}`)}</title>`,
		`<link>${escapeXml(release.url)}</link>`,
		`<guid isPermaLink="true">${escapeXml(release.url)}</guid>`,
		`<pubDate>${new Date(release.publishedAt).toUTCString()}</pubDate>`,
		`<description>${toCdata(release.bodyHtml)}</description>`,
		"</item>",
	].join("")
}

function createFeed(releases: ChangelogRelease[]) {
	const changelogUrl = `${siteConfig.url}/changelog`
	const feedUrl = `${siteConfig.url}/changelog.xml`
	const lastBuild = releases[0]
		? new Date(releases[0].publishedAt).toUTCString()
		: new Date(0).toUTCString()

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
		"<channel>",
		`<title>${escapeXml(changelogCopy.feedTitle)}</title>`,
		`<link>${escapeXml(changelogUrl)}</link>`,
		`<description>${escapeXml(changelogCopy.description)}</description>`,
		"<language>en</language>",
		`<lastBuildDate>${lastBuild}</lastBuildDate>`,
		`<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
		...releases.map(createItem),
		"</channel>",
		"</rss>",
		"",
	].join("\n")
}

export const Route = createFileRoute("/changelog.xml")({
	server: {
		handlers: {
			GET: async () => {
				const changelog = await fetchCachedChangelogReleases()
				const isAvailable = changelog.status !== "unavailable"

				return new Response(createFeed(changelog.releases), {
					status: isAvailable ? 200 : 503,
					headers: {
						"content-type": "application/rss+xml; charset=utf-8",
						"cache-control": isAvailable
							? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
							: "no-store",
					},
				})
			},
		},
	},
})
