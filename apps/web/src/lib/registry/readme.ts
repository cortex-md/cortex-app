const imageExtension = /\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/iu
const absoluteTarget = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/iu

function resolveRepoUrl(target: string, repo: string, branch: string, forceImage: boolean) {
	if (!target || absoluteTarget.test(target)) return target
	const path = target.replace(/^\.\//u, "").replace(/^\/+/u, "")
	return forceImage || imageExtension.test(path)
		? `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
		: `https://github.com/${repo}/blob/${branch}/${path}`
}

function readAttribute(tag: string, name: string) {
	return new RegExp(`\\s${name}=(["'])(.*?)\\1`, "iu").exec(tag)?.[2] ?? ""
}

export function prepareReadmeMarkdown(markdown: string, repo: string, branch = "HEAD") {
	return markdown
		.replace(/<img\b[^>]*>/giu, (tag) => {
			const src = readAttribute(tag, "src")
			return src ? `![${readAttribute(tag, "alt").replace(/[[\]]/gu, "")}](${src})` : ""
		})
		.replace(
			/(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(\s+"[^"]*")?\s*\)/gu,
			(_match, bang: string, text: string, target: string, title = "") =>
				`${bang}[${text}](${resolveRepoUrl(target, repo, branch, bang === "!")}${title})`,
		)
		.replace(
			/^(\s{0,3}\[[^\]]+\]:\s*)<?(\S+?)>?(\s|$)/gmu,
			(_match, prefix: string, target: string, end: string) =>
				`${prefix}${resolveRepoUrl(target, repo, branch, false)}${end}`,
		)
}
