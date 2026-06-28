import { FileText, History, LockKeyhole, ServerCog } from "lucide-react"
import { syncProofs } from "../../../content/landing"
import { ProductMedia } from "../components/ProductMedia"
import { SectionHeading } from "../components/SectionHeading"

type SyncTone = (typeof syncProofs)[number]["tone"]

const syncToneClasses: Record<SyncTone, string> = {
	amber: "bg-accent-amber-subtle text-accent-amber-text",
	coral: "bg-accent-coral-subtle text-accent-coral-text",
	sage: "bg-accent-sage-subtle text-accent-sage-text",
	sky: "bg-accent-sky-subtle text-accent-sky-text",
}

const syncProofIcons = [LockKeyhole, History, ServerCog, FileText] as const

export function SyncSection() {
	return (
		<section className="scroll-mt-24" id="sync">
			<div className="mx-auto w-[min(1180px,calc(100%_-_64px))] py-24 max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-md:py-[80px] max-sm:w-[min(calc(100%_-_28px),520px)] max-sm:py-[68px]">
				<SectionHeading
					title="Sync is optional, encrypted, and yours to host."
					description="Move across devices while keeping plaintext out of the service. Use hosted sync when it fits, or run the server yourself."
				/>

				<div className="mt-12 grid grid-cols-[minmax(0,0.92fr)_minmax(320px,0.78fr)] items-center gap-12 max-lg:grid-cols-1 max-lg:gap-10 max-md:mt-9">
					<ProductMedia
						className="w-full max-w-[700px] justify-self-center max-lg:max-w-[780px] [&_img]:hue-rotate-[-48deg] [&_img]:saturate-[1.12]"
						label="Sync architecture"
						description="Cortex sync keeps readable notes local while the service stores encrypted blobs."
						alt="Cortex Sync technical illustration showing Markdown files, encrypted blobs, and connected devices."
						src="/media/cortex-feature-sync.png"
						webpSrc="/media/cortex-feature-sync.webp"
						width={1307}
						height={557}
						aspect="sync"
						fit="contain"
						frame="bare"
						imageScale="sync"
					/>

					<div>
						<h3 className="m-0 max-w-[560px] text-balance text-[clamp(25px,2.7vw,36px)] leading-[1.08] font-semibold">
							Convenience without handing the service readable notes.
						</h3>
						<p className="mt-4 mb-0 max-w-[560px] text-sm leading-[1.7] text-muted-foreground">
							Sync is a product story about ownership: client-side encryption, encrypted blob
							storage, history, and a self-hostable path.
						</p>

						<ul className="mt-8 mb-0 grid p-0">
							{syncProofs.map((proof, index) => {
								const Icon = syncProofIcons[index] ?? LockKeyhole

								return (
									<li
										className="grid grid-cols-[34px_minmax(0,1fr)] gap-4 border-border/70 border-b py-5 first:pt-0 last:border-b-0 last:pb-0 max-lg:first:pt-5"
										key={proof.title}
									>
										<span
											className={`grid size-[34px] place-items-center rounded-lg ${syncToneClasses[proof.tone]}`}
										>
											<Icon className="size-4" aria-hidden="true" />
										</span>
										<div>
											<h4 className="m-0 text-[17px] leading-tight font-semibold">{proof.title}</h4>
											<p className="mt-2 mb-0 text-sm leading-[1.6] text-muted-foreground">
												{proof.description}
											</p>
										</div>
									</li>
								)
							})}
						</ul>
					</div>
				</div>
			</div>
		</section>
	)
}
