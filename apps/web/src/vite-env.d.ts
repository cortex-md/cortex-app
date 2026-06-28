/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly SITE_URL?: string
	readonly CORTEX_DOWNLOAD_MACOS_URL?: string
	readonly CORTEX_DOWNLOAD_WINDOWS_URL?: string
	readonly CORTEX_DOWNLOAD_LINUX_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
