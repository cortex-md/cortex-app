/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly SITE_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
