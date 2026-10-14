declare global {
	var __CORTEX_REGISTRY_REPO__: string | undefined
}

const DEFAULT_REGISTRY_REPO = "cortex-md/registry"

export function getRegistryRepo(): string {
	return globalThis.__CORTEX_REGISTRY_REPO__ || DEFAULT_REGISTRY_REPO
}

export function registryFileUrl(branch: "main" | "data", fileName: string): string {
	return `https://raw.githubusercontent.com/${getRegistryRepo()}/${branch}/${fileName}`
}
