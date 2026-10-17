/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly SITE_URL?: string
	readonly CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
