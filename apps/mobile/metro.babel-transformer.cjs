const path = require("node:path")

const expoRoot = path.dirname(require.resolve("expo/package.json"))
const upstreamTransformer = require(
	require.resolve("@expo/metro-config/babel-transformer", { paths: [expoRoot] }),
)

const COMMUNITY_PLUGINS_FILE = /packages[/\\]plugin-host-core[/\\]src[/\\]communityPlugins\.ts$/
const DATA_URL_IMPORT = "import(/* @vite-ignore */ moduleUrl)"
const RUNTIME_IMPORT = 'globalThis.eval("(url) => import(url)")(moduleUrl)'

module.exports.transform = (props) => {
	if (COMMUNITY_PLUGINS_FILE.test(props.filename) && props.src.includes(DATA_URL_IMPORT)) {
		return upstreamTransformer.transform({
			...props,
			src: props.src.replace(DATA_URL_IMPORT, RUNTIME_IMPORT),
		})
	}
	return upstreamTransformer.transform(props)
}
