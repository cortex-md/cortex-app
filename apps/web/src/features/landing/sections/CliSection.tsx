import { Button } from "@cortex/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cortex/ui/tabs"
import { Check, CheckCircle2, Copy, TerminalSquare } from "lucide-react"
import { useState } from "react"
import {
	cliFlowSteps,
	cliInstall,
	cliTerminalTabs,
	developerStories,
} from "../../../content/landing"

type CliTone = (typeof cliFlowSteps)[number]["tone"]
type CliTerminalLine = (typeof cliTerminalTabs)[number]["lines"][number]

const cliToneClasses: Record<CliTone, string> = {
	amber: "bg-accent-amber-subtle text-accent-amber-text",
	sage: "bg-accent-sage-subtle text-accent-sage-text",
	sky: "bg-accent-sky-subtle text-accent-sky-text",
}

function getCommandParts(command: string) {
	let offset = 0

	return command.split(/(\s+)/).map((part) => {
		const key = `${offset}-${part}`
		offset += part.length
		return { key, part }
	})
}

function CommandText({ command }: { command: string }) {
	return (
		<span data-command={command}>
			{getCommandParts(command).map(({ key, part }) => {
				if (/^\s+$/.test(part)) {
					return <span key={key}>{part}</span>
				}

				let className = "text-white/[0.9]"
				if (part === "cortex") {
					className = "font-semibold text-brand"
				} else if (part.startsWith("--")) {
					className = "font-semibold text-[#7ecaa0]"
				} else if (part.startsWith("~/") || part.includes("github-emoji")) {
					className = "text-[#d9c8ff]"
				} else if (part === "&&") {
					className = "text-white/38"
				}

				return (
					<span className={className} key={key}>
						{part}
					</span>
				)
			})}
		</span>
	)
}

function TerminalLine({ line }: { line: CliTerminalLine }) {
	if (line.kind === "comment") {
		return <span className="block min-w-max text-white/42">{line.text}</span>
	}

	if (line.kind === "success") {
		return (
			<span className="flex min-w-max items-center gap-2 text-[#7ecaa0]">
				<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
				<span>{line.text}</span>
			</span>
		)
	}

	return (
		<span className="block min-w-max">
			<span className="mr-2 text-white/32">$</span>
			<CommandText command={line.text} />
		</span>
	)
}

function CliTerminalPanel() {
	const defaultTab = cliTerminalTabs[0]?.value

	return (
		<Tabs className="gap-4" defaultValue={defaultTab}>
			<TabsList aria-label="Cortex CLI examples" className="w-fit max-sm:w-full">
				{cliTerminalTabs.map((tab) => (
					<TabsTrigger className="px-3" key={tab.value} value={tab.value}>
						{tab.label}
					</TabsTrigger>
				))}
			</TabsList>

			<figure className="m-0 overflow-hidden rounded-xl bg-[#101010] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_20px_rgba(17,19,26,0.18)]">
				<figcaption className="flex items-center justify-between gap-4 border-white/[0.1] border-b px-4 py-3">
					<span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-white/82">
						<span className="inline-flex gap-1.5" aria-hidden="true">
							<span className="size-2.5 rounded-full bg-[#ff6b65]" />
							<span className="size-2.5 rounded-full bg-[#f5c04f]" />
							<span className="size-2.5 rounded-full bg-[#62d26f]" />
						</span>
					</span>
				</figcaption>

				{cliTerminalTabs.map((tab) => (
					<TabsContent className="m-0" key={tab.value} value={tab.value}>
						<pre className="m-0 overflow-x-auto p-[clamp(16px,2.3vw,24px)] text-[12px] leading-[1.65] text-white/[0.74]">
							<code className="grid gap-2.5">
								{tab.lines.map((line) => (
									<TerminalLine key={`${tab.value}-${line.kind}-${line.text}`} line={line} />
								))}
							</code>
						</pre>
					</TabsContent>
				))}
			</figure>
		</Tabs>
	)
}

function CliFlowTrail() {
	return (
		<ol className="m-0 grid gap-3 p-0" data-cli-flow="side">
			{cliFlowSteps.map((step) => (
				<li
					className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-xl bg-bg-elevated p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(17,19,26,0.04)]"
					key={step.label}
				>
					<span
						className={`grid size-[34px] place-items-center rounded-lg ${cliToneClasses[step.tone]}`}
					>
						<TerminalSquare className="size-4" aria-hidden="true" />
					</span>
					<div>
						<h3 className="m-0 text-[15px] leading-tight font-semibold text-text-primary">
							{step.label}
						</h3>
						<p className="mt-2 mb-0 text-pretty text-sm leading-[1.55] text-muted-foreground">
							{step.description}
						</p>
					</div>
				</li>
			))}
		</ol>
	)
}

function CliInstallCard() {
	const [copied, setCopied] = useState(false)

	async function handleCopy() {
		if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return

		try {
			await navigator.clipboard.writeText(cliInstall.command)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1800)
		} catch {
			setCopied(false)
		}
	}

	return (
		<div className=" p-4 text-text-primary" data-cli-install>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<h3 className="m-0 text-[15px] leading-tight font-semibold">{cliInstall.title}</h3>
					<p className="mt-2 mb-0 text-pretty text-sm leading-[1.55] ">{cliInstall.description}</p>
				</div>
			</div>

			<div className="mt-4 rounded-xl border border-muted grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white/[0.06] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
				<code
					className="min-w-0 overflow-x-auto px-2 text-[12px] leading-8 whitespace-nowrap"
					data-cli-install-command={cliInstall.command}
				>
					{cliInstall.command}
				</code>
				<Button
					className="size-8 p-0 transition-[background-color,color,scale] duration-150 ease-out hover:bg-white/[0.14] active:scale-[0.96] motion-reduce:transition-colors motion-reduce:active:scale-100"
					type="button"
					variant="ghost"
					aria-label={copied ? "CLI install command copied" : "Copy CLI install command"}
					onClick={handleCopy}
				>
					{copied ? (
						<Check className="size-4 text-[#7ecaa0]" aria-hidden="true" />
					) : (
						<Copy className="size-4" aria-hidden="true" />
					)}
				</Button>
			</div>
		</div>
	)
}

export function CliSection() {
	const story = developerStories.cli

	return (
		<section className="scroll-mt-24 py-24 max-md:py-[80px] max-sm:py-[68px]" id="cli">
			<div className="mx-auto w-[min(1180px,calc(100%_-_64px))] max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)]">
				<div className="max-w-[760px]">
					<h2 className="m-0 text-balance text-[clamp(34px,4.2vw,56px)] leading-[1.04] font-semibold">
						{story.title}
					</h2>
					<p className="mt-6 mb-0 max-w-[680px] text-[16px] leading-[1.7] text-muted-foreground">
						{story.description}
					</p>
				</div>

				<div
					className="mt-12 grid grid-cols-[minmax(0,700px)_minmax(280px,1fr)] items-start gap-5 max-lg:grid-cols-1 max-md:mt-10"
					data-cli-layout="terminal-with-flow"
				>
					<div className="min-w-0">
						<CliTerminalPanel />
					</div>
					<aside className="grid min-w-0 gap-3" aria-label="CLI release flow">
						<CliInstallCard />
						<CliFlowTrail />
					</aside>
				</div>
			</div>
		</section>
	)
}
