export interface SemVer {
	major: number
	minor: number
	patch: number
	prerelease: readonly (string | number)[]
}

const SEMVER_PATTERN =
	/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

export function parseSemVer(value: string): SemVer | null {
	const match = SEMVER_PATTERN.exec(value.trim())
	if (!match) return null
	const prerelease = match[4]
		? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
		: []
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease,
	}
}

function compareIdentifiers(left: string | number, right: string | number): number {
	if (typeof left === "number" && typeof right === "number") return Math.sign(left - right)
	if (typeof left === "number") return -1
	if (typeof right === "number") return 1
	return left < right ? -1 : left > right ? 1 : 0
}

export function compareSemVer(left: SemVer, right: SemVer): number {
	const core =
		Math.sign(left.major - right.major) ||
		Math.sign(left.minor - right.minor) ||
		Math.sign(left.patch - right.patch)
	if (core !== 0) return core
	if (left.prerelease.length === 0 || right.prerelease.length === 0) {
		return Math.sign(right.prerelease.length - left.prerelease.length)
	}
	const length = Math.max(left.prerelease.length, right.prerelease.length)
	for (let index = 0; index < length; index++) {
		const leftPart = left.prerelease[index]
		const rightPart = right.prerelease[index]
		if (leftPart === undefined) return -1
		if (rightPart === undefined) return 1
		const result = compareIdentifiers(leftPart, rightPart)
		if (result !== 0) return result
	}
	return 0
}

export function isNewerVersion(candidate: string, current: string): boolean {
	const next = parseSemVer(candidate)
	const installed = parseSemVer(current)
	if (!next || !installed) return false
	return compareSemVer(next, installed) > 0
}

export function isPrerelease(value: string): boolean {
	return (parseSemVer(value)?.prerelease.length ?? 0) > 0
}
