export function compareVersions(a: string, b: string): number {
	const aParts = a.replace(/^v/, "").split(".").map(Number)
	const bParts = b.replace(/^v/, "").split(".").map(Number)
	const length = Math.max(aParts.length, bParts.length)

	for (let i = 0; i < length; i++) {
		const aPart = aParts[i] ?? 0
		const bPart = bParts[i] ?? 0
		if (aPart > bPart) return 1
		if (aPart < bPart) return -1
	}

	return 0
}

export function isVersionCompatible(appVersion: string, minRequired: string): boolean {
	return compareVersions(appVersion, minRequired) >= 0
}
