import { MDXContent } from "@content-collections/mdx/react"
import { Callout, CodeBlock, DocCard, DocGrid, SectionHeading } from "./DocCards"

const mdxComponents = {
	Callout,
	DocCard,
	DocGrid,
	h2: SectionHeading,
	pre: CodeBlock,
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
