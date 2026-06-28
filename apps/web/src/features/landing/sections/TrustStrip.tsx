import { CloudOff, FileText, FolderOpen, GitBranch, LockKeyhole } from "lucide-react"
import { trustContract, trustLedger } from "../../../content/landing"
import { SectionContainer } from "../components/SectionContainer"

type TrustTone = (typeof trustLedger)[number]["tone"]

const trustToneClasses: Record<TrustTone, string> = {
	amber: "bg-accent-amber-subtle text-accent-amber-text",
	coral: "bg-accent-coral-subtle text-accent-coral-text",
	sage: "bg-accent-sage-subtle text-accent-sage-text",
	sky: "bg-accent-sky-subtle text-accent-sky-text",
}

const trustIcons = [FolderOpen, CloudOff, FileText, GitBranch, LockKeyhole] as const

export function TrustStrip() {
	return (
		<section className="py-16 max-md:py-12" aria-labelledby="trust-ledger-title">
			<SectionContainer>
				<div
					className="grid grid-cols-[minmax(260px,0.42fr)_minmax(0,0.58fr)] gap-3 rounded-xl bg-bg-elevated p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_8px_rgba(24,18,8,0.04)] max-lg:grid-cols-1"
					data-trust-strip="file-contract"
				>
					<aside className="flex min-h-[340px] flex-col justify-between overflow-hidden rounded-lg bg-[#303342] p-6 text-white shadow-[inset_0_1px_rgba(255,255,255,0.16)] max-lg:min-h-0">
						<div>
							<span className="grid size-11 place-items-center rounded-lg bg-white/[0.1] text-white shadow-[inset_0_1px_rgba(255,255,255,0.16)]">
								<FolderOpen className="size-5" aria-hidden="true" />
							</span>
							<p className="mt-5 mb-0 text-[13px] leading-5 font-medium text-white/58">
								{trustContract.vault.label}
							</p>
							<h2
								className="mt-2 mb-0 max-w-[360px] text-balance text-[clamp(28px,3.4vw,44px)] leading-[1.04] font-semibold tracking-[-0.02em]"
								id="trust-ledger-title"
							>
								{trustContract.title}
							</h2>
							<p className="mt-5 mb-0 max-w-[420px] text-pretty text-sm leading-[1.7] text-white/68">
								{trustContract.description}
							</p>
						</div>

						<div className="mt-8">
							<p className="m-0 text-[clamp(34px,5vw,58px)] leading-none font-semibold tracking-[-0.035em] text-white">
								{trustContract.vault.path}
							</p>
							<p className="mt-4 mb-0 max-w-[420px] text-pretty text-[13px] leading-6 text-white/62">
								{trustContract.vault.description}
							</p>
							<ul className="mt-5 mb-0 flex flex-wrap gap-2 p-0">
								{trustContract.vault.chips.map((chip) => (
									<li
										className="rounded-full bg-white/[0.09] px-2.5 py-1 text-[12px] leading-4 font-medium text-white/72 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
										key={chip}
									>
										{chip}
									</li>
								))}
							</ul>
						</div>
					</aside>
					<dl
						className="m-0 grid content-start divide-y divide-border-subtle rounded-lg bg-background/65 px-5 py-2 max-sm:px-4"
						data-trust-ledger="stack"
					>
						{trustLedger.map((item, index) => {
							const Icon = trustIcons[index] ?? FileText

							return (
								<div
									className="grid grid-cols-[38px_minmax(0,1fr)_minmax(118px,auto)] items-center gap-4 py-4 max-sm:grid-cols-[34px_minmax(0,1fr)]"
									key={item.step}
								>
									<span
										className={`grid size-[38px] shrink-0 place-items-center rounded-lg ${trustToneClasses[item.tone]}`}
									>
										<Icon className="size-4" aria-hidden="true" />
									</span>
									<dt className="min-w-0">
										<span className="block text-[15px] leading-5 font-semibold text-text-primary">
											{item.label}
										</span>
										<span className="mt-1 block text-[12px] leading-5 text-muted-foreground">
											{item.description}
										</span>
									</dt>
									<dd className="m-0 justify-self-end max-sm:col-start-2 max-sm:justify-self-start">
										<p className="m-0 rounded-full bg-bg-elevated px-3 py-1.5 text-[13px] leading-4 font-semibold text-text-primary shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
											{item.step}
										</p>
									</dd>
								</div>
							)
						})}
						<div className="pt-4 pb-3">
							<p className="m-0 text-pretty text-[13px] leading-6 text-muted-foreground">
								{trustContract.note}
							</p>
						</div>
					</dl>
				</div>
			</SectionContainer>
		</section>
	)
}
