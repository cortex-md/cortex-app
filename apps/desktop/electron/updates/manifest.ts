import type { AppUpdateChannel } from "@cortex/platform"
import { UpdateError } from "./errors"
import { parseSemVer } from "./version"

export type UpdatePackageType = "zip" | "nsis" | "appimage"

export type UpdatePlatformKey = `${"darwin" | "win32" | "linux"}-${"x64" | "arm64"}`

export interface UpdatePackage {
	type: UpdatePackageType
	url: string
	sha256: string
	size: number
}

export interface UpdateManifest {
	version: string
	channel: AppUpdateChannel
	releasedAt: string
	notes: string
	platforms: Partial<Record<UpdatePlatformKey, UpdatePackage>>
}

export const UPDATE_REPOSITORY = "cortex-md/cortex-app"

const RELEASE_DOWNLOAD_PREFIX = `/${UPDATE_REPOSITORY}/releases/download/`
const PLATFORM_KEYS: readonly UpdatePlatformKey[] = [
	"darwin-arm64",
	"darwin-x64",
	"win32-x64",
	"win32-arm64",
	"linux-x64",
	"linux-arm64",
]
const EXPECTED_TYPES: Record<UpdatePlatformKey, UpdatePackageType> = {
	"darwin-arm64": "zip",
	"darwin-x64": "zip",
	"win32-x64": "nsis",
	"win32-arm64": "nsis",
	"linux-x64": "appimage",
	"linux-arm64": "appimage",
}
const SHA256_PATTERN = /^[0-9a-f]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalid(message: string): never {
	throw new UpdateError("MANIFEST_INVALID", message)
}

function readString(record: Record<string, unknown>, key: string): string {
	const value = record[key]
	if (typeof value !== "string" || value.length === 0) invalid(`Manifest field "${key}" is missing`)
	return value
}

export function isTrustedReleaseUrl(value: string): boolean {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		return false
	}
	return (
		url.protocol === "https:" &&
		url.hostname === "github.com" &&
		url.port === "" &&
		url.username === "" &&
		url.password === "" &&
		url.pathname.startsWith(RELEASE_DOWNLOAD_PREFIX) &&
		!url.pathname.includes("..")
	)
}

export type UrlPolicy = (url: string) => boolean

function parsePackage(key: UpdatePlatformKey, value: unknown, allowUrl: UrlPolicy): UpdatePackage {
	if (!isRecord(value)) invalid(`Platform "${key}" is not an object`)
	const type = readString(value, "type")
	if (type !== EXPECTED_TYPES[key]) invalid(`Platform "${key}" has unexpected type "${type}"`)
	const url = readString(value, "url")
	if (!allowUrl(url)) invalid(`Platform "${key}" has an untrusted URL`)
	const sha256 = readString(value, "sha256").toLowerCase()
	if (!SHA256_PATTERN.test(sha256)) invalid(`Platform "${key}" has an invalid sha256`)
	const size = value.size
	if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
		invalid(`Platform "${key}" has an invalid size`)
	}
	return { type, url, sha256, size }
}

/** Call only with bytes whose signature was already verified. */
export function parseManifest(
	text: string,
	allowUrl: UrlPolicy = isTrustedReleaseUrl,
): UpdateManifest {
	let raw: unknown
	try {
		raw = JSON.parse(text)
	} catch {
		invalid("Manifest is not valid JSON")
	}
	if (!isRecord(raw)) invalid("Manifest is not an object")
	const version = readString(raw, "version")
	if (!parseSemVer(version)) invalid(`Manifest version "${version}" is not semver`)
	const channel = readString(raw, "channel")
	if (channel !== "stable" && channel !== "beta") invalid(`Unknown channel "${channel}"`)
	const releasedAt = readString(raw, "releasedAt")
	if (Number.isNaN(Date.parse(releasedAt))) invalid("Manifest releasedAt is not a date")
	const notes = typeof raw.notes === "string" ? raw.notes : ""
	if (!isRecord(raw.platforms)) invalid("Manifest platforms are missing")
	const platforms: Partial<Record<UpdatePlatformKey, UpdatePackage>> = {}
	for (const key of PLATFORM_KEYS) {
		if (raw.platforms[key] !== undefined)
			platforms[key] = parsePackage(key, raw.platforms[key], allowUrl)
	}
	return { version, channel, releasedAt, notes, platforms }
}

export function toPlatformKey(platform: string, arch: string): UpdatePlatformKey | null {
	const key = `${platform}-${arch}`
	return (PLATFORM_KEYS as readonly string[]).includes(key) ? (key as UpdatePlatformKey) : null
}

export function selectPlatformPackage(
	manifest: UpdateManifest,
	platform: string,
	arch: string,
): UpdatePackage {
	const key = toPlatformKey(platform, arch)
	const entry = key ? manifest.platforms[key] : undefined
	if (!entry) {
		throw new UpdateError(
			"NO_PLATFORM_BUILD",
			`Version ${manifest.version} has no build for ${platform}-${arch}`,
		)
	}
	return entry
}

export function releasePageUrl(version: string): string {
	return `https://github.com/${UPDATE_REPOSITORY}/releases/tag/v${encodeURIComponent(version)}`
}
