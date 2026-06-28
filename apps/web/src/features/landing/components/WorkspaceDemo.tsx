import { ArrowRight, FileText, FolderOpen, Search } from "lucide-react"

export function WorkspaceDemo() {
	return (
		<figure className="relative m-0 overflow-hidden rounded-xl bg-bg-elevated shadow-[0_0_0_1px_rgba(0,0,0,0.075),0_2px_8px_rgba(24,18,8,0.06)]">
			<figcaption className="sr-only">
				Cortex workspace demo with a Markdown folder, live editor, preview, command palette, and a
				Finder confirmation that the note stays as a plain Markdown file.
			</figcaption>
			<div className="grid min-h-[540px] grid-cols-[220px_minmax(0,1fr)] max-lg:grid-cols-[190px_minmax(0,1fr)] max-md:min-h-0 max-md:grid-cols-1">
				<aside className="border-border border-r bg-bg-secondary p-5 max-md:border-r-0 max-md:border-b max-sm:p-3">
					<div className="flex items-center justify-between gap-3">
						<div className="flex gap-1.5" aria-hidden="true">
							<span className="size-2.5 rounded-full bg-accent-coral" />
							<span className="size-2.5 rounded-full bg-accent-amber" />
							<span className="size-2.5 rounded-full bg-accent-sage" />
						</div>
						<span className="rounded-md bg-bg-elevated px-2 py-1 text-[11px] font-medium text-muted-foreground max-sm:hidden">
							Local vault
						</span>
					</div>

					<div className="mt-8 flex items-center gap-2 text-sm font-semibold max-sm:mt-5">
						<FolderOpen className="size-4 shrink-0" aria-hidden="true" />
						<span className="min-w-0 truncate">field-notes</span>
					</div>

					<div className="mt-6 grid gap-1.5 max-md:grid-cols-2">
						{["index.md", "ideas.md", "research.md", "sync-plan.md"].map((file, index) => (
							<span
								className={`block truncate rounded-md px-3 py-2 text-[13px] font-medium max-sm:px-2 ${
									index === 1 ? "bg-accent-sky-subtle text-accent-sky-text" : "text-text-secondary"
								}`}
								key={file}
							>
								{file}
							</span>
						))}
					</div>

					<div className="mt-8 rounded-lg border border-border/70 bg-bg-elevated p-3 max-md:hidden">
						<p className="m-0 text-[12px] font-semibold text-text-primary">Plain file</p>
						<p className="mt-1 mb-0 truncate text-[12px] text-muted-foreground">~/notes/ideas.md</p>
					</div>
				</aside>

				<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_260px] max-lg:grid-cols-1">
					<div className="min-w-0 bg-bg-elevated p-[clamp(24px,4vw,52px)] max-sm:p-4">
						<div className="mb-8 flex min-w-0 flex-wrap items-center gap-2">
							<div className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-semibold text-text-secondary">
								<FileText className="size-3.5 shrink-0" aria-hidden="true" />
								<span className="truncate">ideas.md</span>
							</div>
							<span className="rounded-md bg-brand-subtle px-2.5 py-1 text-[12px] font-semibold text-brand-text">
								Live Preview
							</span>
						</div>

						<h3 className="m-0 max-w-[560px] text-balance text-[clamp(30px,4.4vw,56px)] leading-[1.02] font-semibold tracking-[-0.02em] max-sm:text-[25px]">
							Tools should disappear into the work.
						</h3>
						<p className="mt-5 max-w-[520px] text-[15px] leading-[1.65] text-text-secondary max-sm:text-sm">
							A useful workspace protects attention without asking you to surrender ownership.
						</p>
						<div className="mt-8 max-w-[560px] rounded-lg bg-bg-secondary p-4 text-sm leading-[1.65] text-text-secondary max-sm:hidden">
							Plain files are not a limitation. They are the foundation of a durable system.
						</div>

						<div className="mt-8 rounded-lg border border-border/80 bg-background p-3">
							<div className="flex items-center gap-2 text-[12px] font-semibold text-text-secondary">
								<Search className="size-3.5" aria-hidden="true" />
								<span className="min-w-0 truncate">Command palette</span>
								<kbd className="ml-auto rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
									⌘ K
								</kbd>
							</div>
							<div className="mt-3 grid gap-1.5">
								{["Search vault", "Split right", "Reveal in Finder"].map((item, index) => (
									<span
										className={`flex items-center justify-between rounded-md px-3 py-2 text-[12px] ${
											index === 2
												? "bg-accent-amber-subtle text-accent-amber-text"
												: "bg-bg-elevated text-text-secondary"
										}`}
										key={item}
									>
										<span>{item}</span>
										{index === 2 ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
									</span>
								))}
							</div>
						</div>
					</div>

					<div className="border-border border-l bg-bg-secondary p-6 max-lg:hidden">
						<p className="m-0 text-sm font-semibold text-text-primary">Preview</p>
						<div className="mt-7 grid gap-3">
							<div className="h-2.5 w-28 rounded-full bg-brand" />
							<div className="h-3 w-52 max-w-full rounded-full bg-text-primary" />
							<div className="h-2 rounded-full bg-border-strong" />
							<div className="h-2 w-[86%] rounded-full bg-border-strong" />
							<div className="mt-7 rounded-lg border border-border bg-bg-elevated p-4">
								<div className="h-2.5 w-20 rounded-full bg-brand" />
								<div className="mt-4 h-2 w-full rounded-full bg-border-strong" />
								<div className="mt-3 h-2 w-32 rounded-full bg-border-strong" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</figure>
	)
}
