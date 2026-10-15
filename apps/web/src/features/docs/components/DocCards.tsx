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

export function CodeBlock({ className, children, ...props }: ComponentProps<"pre">) {
	const preRef = useRef<HTMLPreElement | null>(null)
	const [copied, setCopied] = useState(false)

	async function handleCopy() {
		const text = preRef.current?.innerText ?? ""
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1600)
		} catch {
			setCopied(false)
		}
	}

	return (
		<div className="group/code relative my-5 overflow-hidden rounded-[14px] bg-bg-elevated shadow-ring">
			<pre ref={preRef} className={cn(className, "overflow-x-auto")} {...props}>
				{children}
			</pre>
			<button
				type="button"
				className="absolute top-2 right-2 inline-flex h-7 items-center gap-1.5 rounded-full bg-bg-elevated px-2.5 text-[12px] leading-none font-medium text-text-secondary opacity-0 shadow-ring outline-none transition-opacity duration-150 group-hover/code:opacity-100 hover:text-text-primary focus-visible:opacity-100 focus-visible:shadow-focus max-[1000px]:opacity-100"
				onClick={handleCopy}
			>
				{copied ? (
					<Check className="size-3.5" aria-hidden="true" />
				) : (
					<Copy className="size-3.5" aria-hidden="true" />
				)}
				{copied ? docsCopy.copiedCode : docsCopy.copyCode}
			</button>
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
