import type { ConfigContext, ExpoConfig } from "expo/config"

const isProduction = process.env.APP_VARIANT === "production"

type PluginEntry = NonNullable<ExpoConfig["plugins"]>[number]

function withCleartextInDevelopment(plugin: PluginEntry): PluginEntry {
	if (isProduction || !Array.isArray(plugin) || plugin[0] !== "expo-build-properties") return plugin
	const options = (plugin[1] ?? {}) as { android?: Record<string, unknown> }
	return [plugin[0], { ...options, android: { ...options.android, usesCleartextTraffic: true } }]
}

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: config.name ?? "Cortex",
	slug: config.slug ?? "Cortex",
	plugins: config.plugins?.map(withCleartextInDevelopment),
})
