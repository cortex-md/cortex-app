import { cn } from "@cortex/ui/lib/utils"
import { Laptop, Lock, Smartphone } from "lucide-react"
import { useRef } from "react"
import { syncPage } from "../../../content/product"
import { revealClass } from "../../site/motion"
import { GroupHeading, ProductSection } from "../shared/layout"
import { useScrambledText } from "./useScrambledText"

const { encryption } = syncPage
const nodeIcons = [Laptop, Lock, Smartphone]

function Wire() {
	return (
		<div
			className="relative mx-2.5 h-0.5 bg-[repeating-linear-gradient(90deg,var(--site-sep)_0_6px,transparent_6px_12px)] max-sm:mx-auto max-sm:my-1 max-sm:h-11 max-sm:w-0.5 max-sm:bg-[repeating-linear-gradient(180deg,var(--site-sep)_0_6px,transparent_6px_12px)]"
			aria-hidden="true"
		>
			{[0, 0.8, 1.6].map((delay) => (
				<i
					key={delay}
					className="absolute -top-1 left-0 size-2.5 rounded-full bg-brand opacity-0 shadow-[0_0_0_4px_var(--accent-subtle)] animate-product-flow motion-reduce:hidden max-sm:-left-1 max-sm:animate-product-flow-vertical"
					style={{ animationDelay: `${delay}s` }}
				/>
			))}
		</div>
	)
}

export function SyncEncryptionSection() {
	const cipherRef = useRef<HTMLDivElement>(null)
	const cipher = useScrambledText(cipherRef)

	return (
		<ProductSection>
			<GroupHeading title={encryption.title} quiet={encryption.quiet} body={encryption.body} />
			<div
				className={cn(
					"mt-14 grid grid-cols-[1fr_90px_1fr_90px_1fr] items-center max-sm:mt-9 max-sm:grid-cols-[minmax(0,1fr)]",
					revealClass,
				)}
			>
				{encryption.nodes.map((node, index) => {
					const Icon = nodeIcons[index] ?? Laptop
					const isServer = index === 1
					return (
						<div key={node.label} className="contents">
							{index > 0 ? <Wire /> : null}
							<div
								className={cn(
									"flex flex-col gap-2.5 rounded-[20px] p-5 text-left",
									isServer
										? "bg-[#1c1917] text-[#e7e5e4] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]"
										: "bg-bg-elevated shadow-ring",
								)}
							>
								<h3 className="flex items-center gap-2 text-[15px] leading-none font-semibold">
									<Icon className="size-4" aria-hidden="true" />
									{node.label}
								</h3>
								{isServer ? (
									<div
										ref={cipherRef}
										className="min-h-[92px] rounded-xl bg-white/[0.06] p-3.5 font-mono text-[13.5px] leading-[22px] break-all text-[#86efac]"
									>
										{cipher}
									</div>
								) : (
									<div className="min-h-[92px] rounded-xl bg-cell p-3.5 text-[15px] leading-6">
										{encryption.note}
									</div>
								)}
								<small
									className={cn(
										"text-[12.5px] leading-[1.3]",
										isServer ? "text-[#a8a29e]" : "text-text-muted",
									)}
								>
									{node.caption}
								</small>
							</div>
						</div>
					)
				})}
			</div>
		</ProductSection>
	)
}
