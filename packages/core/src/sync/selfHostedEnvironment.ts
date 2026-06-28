export interface SelfHostedEnvironmentField {
	key: string
	label: string
	defaultValue: string
	secret?: boolean
}

export interface SelfHostedEnvironmentSubsection {
	id: string
	label: string
	fields: SelfHostedEnvironmentField[]
}

export interface SelfHostedEnvironmentGroup {
	id: string
	label: string
	description: string
	sections: SelfHostedEnvironmentSubsection[]
}

export const SELF_HOSTED_ENVIRONMENT_GROUPS: SelfHostedEnvironmentGroup[] = [
	{
		id: "server",
		label: "Server",
		description: "Minimal runtime settings for a self-hosted sync server.",
		sections: [
			{
				id: "runtime",
				label: "Runtime",
				fields: [
					{ key: "CORTEX_SERVER_ENV", label: "Environment", defaultValue: "production" },
					{
						key: "CORTEX_SERVER_TRUST_PROXY_HEADERS",
						label: "Trust proxy headers",
						defaultValue: "true",
					},
				],
			},
		],
	},
	{
		id: "database",
		label: "Database",
		description: "PostgreSQL connection string.",
		sections: [
			{
				id: "database",
				label: "Database",
				fields: [
					{
						key: "CORTEX_DATABASE_URL",
						label: "PostgreSQL URL",
						defaultValue: "postgres://cortex:cortex@localhost:5432/cortex_sync?sslmode=disable",
					},
				],
			},
		],
	},
	{
		id: "authentication",
		label: "Authentication",
		description: "Token signing secret.",
		sections: [
			{
				id: "authentication",
				label: "Authentication",
				fields: [
					{
						key: "CORTEX_AUTH_ACCESS_TOKEN_SECRET",
						label: "Access token secret",
						defaultValue: "change-me-in-production",
						secret: true,
					},
				],
			},
		],
	},
	{
		id: "storage",
		label: "Storage",
		description: "Local MinIO or remote S3-compatible snapshot storage.",
		sections: [
			{
				id: "storage",
				label: "Storage",
				fields: [
					{
						key: "CORTEX_STORAGE_BACKEND",
						label: "Backend",
						defaultValue: "r2",
					},
					{
						key: "CORTEX_STORAGE_ENDPOINT",
						label: "Endpoint",
						defaultValue: "https://account-id.r2.cloudflarestorage.com",
					},
					{
						key: "CORTEX_STORAGE_ACCESS_KEY",
						label: "Access key",
						defaultValue: "replace-with-storage-access-key",
						secret: true,
					},
					{
						key: "CORTEX_STORAGE_SECRET_KEY",
						label: "Secret key",
						defaultValue: "replace-with-storage-secret-key",
						secret: true,
					},
					{
						key: "CORTEX_STORAGE_BUCKET",
						label: "Bucket",
						defaultValue: "cortex-snapshots",
					},
					{ key: "CORTEX_STORAGE_REGION", label: "Region", defaultValue: "auto" },
				],
			},
		],
	},
]

export const SELF_HOSTED_ENVIRONMENT_FIELDS = SELF_HOSTED_ENVIRONMENT_GROUPS.flatMap((group) =>
	group.sections.flatMap((section) => section.fields),
)

export function createSyncEnvironmentSecretKey(vaultId: string, fieldKey: string): string {
	return `sync-env-secret:${vaultId}:${fieldKey}`
}

function serializeEnvironmentValue(value: string): string {
	if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value
	return `"${value
		.replace(/\\/g, "\\\\")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/"/g, '\\"')
		.replace(/\$/g, "\\$")}"`
}

export function serializeSelfHostedEnvironment(
	values: Record<string, string>,
	secrets: Record<string, string>,
): string {
	return SELF_HOSTED_ENVIRONMENT_FIELDS.map((field) => {
		const value = field.secret ? secrets[field.key] : values[field.key]
		return `${field.key}=${serializeEnvironmentValue(value || field.defaultValue)}`
	}).join("\n")
}
