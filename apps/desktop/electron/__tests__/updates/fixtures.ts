import { generateKeyPairSync, type KeyObject, sign } from "node:crypto"

export interface TestKeys {
	publicKey: KeyObject
	privateKey: KeyObject
}

export function createTestKeys(): TestKeys {
	return generateKeyPairSync("ed25519")
}

export function signManifest(text: string, privateKey: KeyObject): string {
	return sign(null, Buffer.from(text), privateKey).toString("base64")
}

const SHA = "a".repeat(64)

export function releaseUrl(file: string, tag = "v1.4.0"): string {
	return `https://github.com/cortex-md/cortex-app/releases/download/${tag}/${file}`
}

export function manifestJson(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		version: "1.4.0",
		channel: "stable",
		releasedAt: "2026-10-17T12:00:00Z",
		notes: "Faster sync",
		platforms: {
			"darwin-arm64": {
				type: "zip",
				url: releaseUrl("Cortex-mac-arm64.zip"),
				sha256: SHA,
				size: 10,
			},
			"win32-x64": {
				type: "nsis",
				url: releaseUrl("Cortex-win-x64.exe"),
				sha256: SHA,
				size: 10,
			},
			"linux-x64": {
				type: "appimage",
				url: releaseUrl("Cortex-linux-x86_64.AppImage"),
				sha256: SHA,
				size: 10,
			},
		},
		...overrides,
	})
}
