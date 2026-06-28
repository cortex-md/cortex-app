import { describe, expect, it } from "vitest"
import { formatLastSyncedAt, SYNC_STATUS_PRESENTATION } from "./presentation"
import {
	createSyncEnvironmentSecretKey,
	SELF_HOSTED_ENVIRONMENT_FIELDS,
	SELF_HOSTED_ENVIRONMENT_GROUPS,
	serializeSelfHostedEnvironment,
} from "./selfHostedEnvironment"

describe("self-hosted sync environment", () => {
	it("keeps the catalog ordered and field keys unique", () => {
		expect(SELF_HOSTED_ENVIRONMENT_GROUPS.map((group) => group.id)).toEqual([
			"server",
			"database",
			"authentication",
			"storage",
		])
		const fieldKeys = SELF_HOSTED_ENVIRONMENT_FIELDS.map((field) => field.key)
		expect(new Set(fieldKeys).size).toBe(SELF_HOSTED_ENVIRONMENT_FIELDS.length)
		expect(fieldKeys).toContain("CORTEX_SERVER_ENV")
		expect(fieldKeys).toContain("CORTEX_STORAGE_BACKEND")
		expect(fieldKeys).not.toContain("CORTEX_STORAGE_MODE")
		expect(fieldKeys).not.toContain("CORTEX_STORAGE_REMOTE_PROVIDER")
		expect(fieldKeys).not.toContain("CORTEX_CORS_ALLOWED_ORIGINS")
		expect(fieldKeys).not.toContain("CORTEX_S3_CREATE_BUCKET")
	})

	it("creates vault-scoped secret keys", () => {
		expect(createSyncEnvironmentSecretKey("vault-id", "CORTEX_STORAGE_SECRET_KEY")).toBe(
			"sync-env-secret:vault-id:CORTEX_STORAGE_SECRET_KEY",
		)
	})

	it("serializes values in catalog order and resolves secrets separately", () => {
		const serialized = serializeSelfHostedEnvironment(
			{
				CORTEX_SERVER_ENV: "production",
				CORTEX_DATABASE_URL: "postgres://custom",
			},
			{
				CORTEX_AUTH_ACCESS_TOKEN_SECRET: "auth-secret",
				CORTEX_STORAGE_SECRET_KEY: "storage-secret",
			},
		)
		const lines = serialized.split("\n")

		expect(lines[0]).toBe("CORTEX_SERVER_ENV=production")
		expect(lines).toContain("CORTEX_DATABASE_URL=postgres://custom")
		expect(lines).toContain("CORTEX_AUTH_ACCESS_TOKEN_SECRET=auth-secret")
		expect(lines).toContain("CORTEX_STORAGE_BACKEND=r2")
		expect(lines).toContain("CORTEX_STORAGE_SECRET_KEY=storage-secret")
		expect(lines).toHaveLength(SELF_HOSTED_ENVIRONMENT_FIELDS.length)
	})

	it("quotes and escapes values that are unsafe in dotenv syntax", () => {
		const serialized = serializeSelfHostedEnvironment(
			{
				CORTEX_DATABASE_URL: "postgres://cortex:pass word@localhost:5432/cortex#main",
			},
			{
				CORTEX_AUTH_ACCESS_TOKEN_SECRET: 'auth "secret"\nnext',
				CORTEX_STORAGE_SECRET_KEY: "storage-$secret",
			},
		)
		const lines = serialized.split("\n")

		expect(lines).toContain(
			'CORTEX_DATABASE_URL="postgres://cortex:pass word@localhost:5432/cortex#main"',
		)
		expect(lines).toContain('CORTEX_AUTH_ACCESS_TOKEN_SECRET="auth \\"secret\\"\\nnext"')
		expect(lines).toContain('CORTEX_STORAGE_SECRET_KEY="storage-\\$secret"')
	})
})

describe("sync settings presentation", () => {
	it("defines a label and tone for every engine state", () => {
		expect(Object.keys(SYNC_STATUS_PRESENTATION)).toEqual([
			"idle",
			"authenticating",
			"connecting",
			"syncing",
			"live",
			"offline",
			"recovering",
			"denied",
		])
		expect(SYNC_STATUS_PRESENTATION.live).toEqual({ label: "Synced", tone: "success" })
		expect(SYNC_STATUS_PRESENTATION.denied).toEqual({
			label: "Access denied",
			tone: "error",
		})
	})

	it("formats relative sync timestamps with an injected clock", () => {
		const now = new Date("2026-06-14T12:00:00.000Z").getTime()
		expect(formatLastSyncedAt(null, () => now)).toBe("Not synced yet")
		expect(formatLastSyncedAt(now - 30_000, () => now)).toBe("Just now")
		expect(formatLastSyncedAt(now - 60_000, () => now)).toBe("1 minute ago")
		expect(formatLastSyncedAt(now - 120 * 60_000, () => now)).toBe("2 hours ago")
	})
})
