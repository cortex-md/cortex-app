const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

const editorPackageRoot = path.resolve(__dirname, "../../packages/editor")
const katexStylesheet = require.resolve("katex/dist/katex.min.css", { paths: [editorPackageRoot] })

const moduleAliases = {
	"isomorphic-webcrypto/src/react-native": path.resolve(__dirname, "src/platform/webcryptoShim.ts"),
	"katex/dist/katex.min.css": katexStylesheet,
	"katex/dist/katex.min.css?url": path.resolve(__dirname, "src/features/editor/katexStylesheetUrl.ts"),
}

const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
	const alias = moduleAliases[moduleName]
	if (alias) return { filePath: alias, type: "sourceFile" }
	return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
