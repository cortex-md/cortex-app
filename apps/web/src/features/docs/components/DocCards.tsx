import { cn } from "@cortex/ui/lib/utils"
import {
	Check,
	Cloud,
	Code2,
	Copy,
	FileText,
	Info,
	type LucideIcon,
	Moon,
	Terminal,
	Zap,
} from "lucide-react"
import { type ComponentProps, type ReactNode, useRef, useState } from "react"
import { docsCopy } from "../../../content/docs"
import { codeBarClass, codeFrameClass } from "../../../lib/codeFrame"

const sectionIcons: Array<[string, LucideIcon]> = [
	["/docs/get-started/", Zap],
	["/docs/workspace/", FileText],
	["/docs/plugins/", Code2],
	["/docs/themes/", Moon],
	["/docs/sync/", Cloud],
	["/docs/developers/", Terminal],
]

function getCardIcon(href: string) {
	return sectionIcons.find(([prefix]) => href.startsWith(prefix))?.[1] ?? FileText
}

export function DocGrid({ children }: { children: ReactNode }) {
	return (
		<div className="not-prose my-6 mb-2 grid grid-cols-2 gap-2.5 max-[820px]:grid-cols-1">
			{children}
		</div>
	)
}

export function DocCard({
	href,
	title,
	description,
}: {
	href: string
	title: string
	description: string
}) {
	const Icon = getCardIcon(href)

	return (
		<a
			className="flex gap-3.5 rounded-[14px] bg-bg-elevated p-4 no-underline! shadow-ring outline-none transition-[box-shadow,translate] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_0_0_1px_var(--accent-border),var(--site-lift)] focus-visible:shadow-focus motion-reduce:hover:translate-y-0"
			href={href}
		>
			<span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-brand-text">
				<Icon className="size-4" aria-hidden="true" />
			</span>
			<span className="min-w-0">
				<span className="block text-[15px] leading-[1.3] font-semibold text-text-primary">
					{title}
				</span>
				<span className="mt-0.5 block text-[13px] leading-normal text-text-secondary">
					{description}
				</span>
			</span>
		</a>
	)
}

export function Callout({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<div className="not-prose my-5 flex gap-3 rounded-xl bg-brand-subtle px-4 py-3.5 text-[15px] leading-6 text-text-secondary">
			<Info className="mt-1 size-4 shrink-0 text-brand-text" aria-hidden="true" />
			<div className="min-w-0 [&>p:last-child]:mb-0">
				{title ? <b className="text-brand-text">{title} </b> : null}
				{children}
			</div>
		</div>
	)
}

export function CopyCodeButton({ getText }: { getText: () => string }) {
	const [copied, setCopied] = useState(false)

	async function handleCopy() {
		const text = getText()
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1600)
		} catch {
			setCopied(false)
		}
	}

	return (
		<button
			type="button"
			className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] leading-none font-medium text-text-secondary outline-none transition-colors duration-150 hover:bg-site-hover hover:text-text-primary focus-visible:shadow-focus"
			onClick={handleCopy}
		>
			{copied ? (
				<Check className="size-3.5" aria-hidden="true" />
			) : (
				<Copy className="size-3.5" aria-hidden="true" />
			)}
			{copied ? docsCopy.copiedCode : docsCopy.copyCode}
		</button>
	)
}

export function CodeBlock({
	className,
	children,
	"data-language": language,
	...props
}: ComponentProps<"pre"> & { "data-language"?: string }) {
	const preRef = useRef<HTMLPreElement | null>(null)

	return (
		<div className={codeFrameClass}>
			<div className={codeBarClass}>
				{language}
				<CopyCodeButton getText={() => preRef.current?.innerText ?? ""} />
			</div>
			<pre ref={preRef} className={cn(className, "overflow-x-auto")} {...props}>
				{children}
			</pre>
		</div>
	)
}

export function SectionHeading({ id, children, ...props }: ComponentProps<"h2">) {
	return (
		<h2 id={id} className="group/heading" {...props}>
			{children}
			{id ? (
				<a
					className="ml-1.5 text-text-muted no-underline! opacity-0 outline-none transition-opacity group-hover/heading:opacity-100 focus-visible:opacity-100 focus-visible:shadow-focus"
					href={`#${id}`}
					aria-label={docsCopy.sectionLinkLabel}
				>
					#
				</a>
			) : null}
		</h2>
	)
}
