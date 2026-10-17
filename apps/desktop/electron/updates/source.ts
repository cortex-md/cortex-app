import type { KeyObject } from "node:crypto"
import type { AppUpdateChannel } from "@cortex/platform"
import { toUpdateError, UpdateError } from "./errors"
import { parseManifest, UPDATE_REPOSITORY, type UpdateManifest, type UrlPolicy } from "./manifest"
import { verifyManifestSignature } from "./signature"

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export const MANIFEST_FILE = "latest.json"
export const SIGNATURE_FILE = "latest.json.sig"

export interface ManifestLocation {
	manifestUrl: string
	signatureUrl: string
}

export interface ManifestSourceOptions {
	channel: AppUpdateChannel
	fetch: FetchLike
	publicKey: KeyObject
	allowUrl: UrlPolicy
	allowResponseUrl: UrlPolicy
}

interface GitHubReleaseAsset {
	name: string
	browser_download_url: string
}

interface GitHubRelease {
	draft: boolean
	assets: GitHubReleaseAsset[]
}

const GITHUB_HEADERS = {
	Accept: "application/vnd.github+json",
	"User-Agent": "Cortex desktop updater",
}

const TRUSTED_RESPONSE_HOSTS = new Set([
	"github.com",
	"api.github.com",
	"objects.githubusercontent.com",
	"release-assets.githubusercontent.com",
])

export function isTrustedResponseUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.protocol === "https:" && TRUSTED_RESPONSE_HOSTS.has(url.hostname)
	} catch {
		return false
	}
}

export function stableManifestLocation(): ManifestLocation {
	const base = `https://github.com/${UPDATE_REPOSITORY}/releases/latest/download`
	return { manifestUrl: `${base}/${MANIFEST_FILE}`, signatureUrl: `${base}/${SIGNATURE_FILE}` }
}

export function pickManifestLocation(releases: readonly GitHubRelease[]): ManifestLocation | null {
	for (const release of releases) {
		if (release.draft) continue
		const manifest = release.assets.find((asset) => asset.name === MANIFEST_FILE)
		const signature = release.assets.find((asset) => asset.name === SIGNATURE_FILE)
		if (manifest && signature) {
			return {
				manifestUrl: manifest.browser_download_url,
				signatureUrl: signature.browser_download_url,
			}
		}
	}
	return null
}

async function request(url: string, options: ManifestSourceOptions, init?: RequestInit) {
	let response: Response
	try {
		response = await options.fetch(url, { redirect: "follow", ...init })
	} catch (error) {
		throw toUpdateError(error, "NETWORK")
	}
	if (response.url && !options.allowResponseUrl(response.url)) {
		throw new UpdateError("NETWORK", `Update request was redirected to an untrusted host`)
	}
	if (!response.ok) {
		throw new UpdateError("NETWORK", `Update request failed with HTTP ${response.status}`)
	}
	return response
}

async function resolveLocation(options: ManifestSourceOptions): Promise<ManifestLocation> {
	if (options.channel === "stable") return stableManifestLocation()
	const response = await request(
		`https://api.github.com/repos/${UPDATE_REPOSITORY}/releases?per_page=10`,
		options,
		{ headers: GITHUB_HEADERS },
	)
	const releases = (await response.json()) as GitHubRelease[]
	const location = Array.isArray(releases) ? pickManifestLocation(releases) : null
	if (!location) throw new UpdateError("NETWORK", "No release with an update manifest was found")
	return location
}

export async function fetchSignedManifest(options: ManifestSourceOptions): Promise<UpdateManifest> {
	const location = await resolveLocation(options)
	const fixedLocation = options.channel === "stable"
	if (
		!fixedLocation &&
		(!options.allowUrl(location.manifestUrl) || !options.allowUrl(location.signatureUrl))
	) {
		throw new UpdateError("MANIFEST_INVALID", "The update manifest URL is not trusted")
	}
	const [manifestResponse, signatureResponse] = await Promise.all([
		request(location.manifestUrl, options),
		request(location.signatureUrl, options),
	])
	const [manifestBytes, signature] = await Promise.all([
		manifestResponse.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
		signatureResponse.text(),
	])
	verifyManifestSignature(manifestBytes, signature, options.publicKey)
	const manifest = parseManifest(new TextDecoder().decode(manifestBytes), options.allowUrl)
	if (options.channel === "stable" && manifest.channel !== "stable") {
		throw new UpdateError("MANIFEST_INVALID", "A beta manifest was served on the stable channel")
	}
	return manifest
}
