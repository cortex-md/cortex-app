import path from "node:path"
import { createBuilder } from "@content-collections/core"
import viteReact from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"

const uiSource = path.resolve(import.meta.dirname, "../../packages/ui/src")
const webNodeModules = path.resolve(import.meta.dirname, "node_modules")
const webReact = path.resolve(webNodeModules, "react")
const webReactDom = path.resolve(webNodeModules, "react-dom")
const contentCollectionsConfig = path.resolve(import.meta.dirname, "content-collections.ts")
const generatedContentCollections = path.resolve(
	import.meta.dirname,
	".content-collections/generated",
)

function contentCollectionsOnce(): Plugin {
	return {
		name: "content-collections-once",
		async buildStart() {
			const builder = await createBuilder(contentCollectionsConfig)
			await builder.build()
		},
	}
}

export default defineConfig({
	plugins: [contentCollectionsOnce(), viteReact()],
	resolve: {
		dedupe: ["react", "react-dom"],
		alias: [
			{
				find: /^react$/,
				replacement: path.resolve(webReact, "index.js"),
			},
			{
				find: /^react\/jsx-runtime$/,
				replacement: path.resolve(webReact, "jsx-runtime.js"),
			},
			{
				find: /^react-dom$/,
				replacement: path.resolve(webReactDom, "index.js"),
			},
			{
				find: /^react-dom\/client$/,
				replacement: path.resolve(webReactDom, "client.js"),
			},
			{
				find: /^cmdk$/,
				replacement: path.resolve(webNodeModules, "cmdk/dist/index.mjs"),
			},
			{
				find: "content-collections",
				replacement: generatedContentCollections,
			},
			{
				find: /^radix-ui$/,
				replacement: path.resolve(webNodeModules, "radix-ui/dist/index.mjs"),
			},
			{
				find: /^@cortex\/ui\/(.+)$/,
				replacement: `${uiSource}/$1`,
			},
		],
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		restoreMocks: true,
	},
})
