const requiredUrls = ["CORTEX_SYNC_SERVER_URL", "CORTEX_BILLING_URL"]

let failed = false

for (const key of requiredUrls) {
	const value = process.env[key]?.trim()
	if (!value) {
		console.error(`${key} is required for desktop release builds.`)
		failed = true
		continue
	}

	let parsed
	try {
		parsed = new URL(value)
	} catch {
		console.error(`${key} must be a valid URL.`)
		failed = true
		continue
	}

	if (parsed.protocol !== "https:") {
		console.error(`${key} must use https in release builds.`)
		failed = true
	}

	if (value.endsWith("/")) {
		console.error(`${key} must not include a trailing slash.`)
		failed = true
	}
}

if (failed) {
	process.exit(1)
}
