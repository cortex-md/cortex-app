import { MDXContent } from "@content-collections/mdx/react"
import { DocCard, DocGrid } from "./DocCards"

const mdxComponents = {
	DocCard,
	DocGrid,
}

interface DocsMarkdownProps {
	code: string
}

export function DocsMarkdown({ code }: DocsMarkdownProps) {
	return (
		<div className="markdown-surface docs-markdown">
			<MDXContent code={code} components={mdxComponents} />
		</div>
	)
}
