import { cn } from "@cortex/ui/lib/utils"
import type React from "react"

function SignalIcon() {
	return (
		<svg className="h-3 w-[17px] fill-current" viewBox="0 0 17 12" aria-hidden="true">
			<rect x="0" y="8" width="3" height="4" rx="1" />
			<rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
			<rect x="9" y="3" width="3" height="9" rx="1" />
			<rect x="13.5" y="0" width="3" height="12" rx="1" />
		</svg>
	)
}

function WifiIcon() {
	return (
		<svg className="h-3 w-[17px] fill-current" viewBox="0 0 16 12" aria-hidden="true">
			<path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5zM3.4 6.8a6.6 6.6 0 0 1 9.2 0l-1.1 1.1a5 5 0 0 0-7 0L3.4 6.8zM1.2 4.6a9.7 9.7 0 0 1 13.6 0l-1.1 1.1a8.1 8.1 0 0 0-11.4 0L1.2 4.6z" />
		</svg>
	)
}

export function PhoneFrame({
	className,
	children,
}: {
	className?: string
	children: React.ReactNode
}) {
	return (
		<div
			className={cn(
				"relative h-[588px] w-[284px] rounded-[58px] bg-[linear-gradient(145deg,#e9e6e1_0%,#a7a39d_22%,#5f5c58_50%,#b6b2ac_78%,#ece9e4_100%)] p-[11px] shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_40px_80px_-30px_rgba(20,15,20,0.55),0_18px_30px_-18px_rgba(20,15,20,0.45)] before:absolute before:inset-1 before:rounded-[54px] before:bg-[#0d0c0c]",
				className,
			)}
		>
			<i className="absolute top-[112px] -left-[3px] h-[30px] w-1 rounded-[2px] bg-[linear-gradient(90deg,#6d6965,#b9b5af)]" />
			<i className="absolute top-40 -left-[3px] h-[54px] w-1 rounded-[2px] bg-[linear-gradient(90deg,#6d6965,#b9b5af)]" />
			<i className="absolute top-[226px] -left-[3px] h-[54px] w-1 rounded-[2px] bg-[linear-gradient(90deg,#6d6965,#b9b5af)]" />
			<i className="absolute top-[178px] -right-[3px] h-[84px] w-1 rounded-[2px] bg-[linear-gradient(90deg,#6d6965,#b9b5af)]" />
			<div className="relative z-[1] h-full overflow-hidden rounded-[47px] bg-bg-primary px-[18px] pt-[58px] text-left text-[14px] leading-[22px]">
				<div className="absolute inset-x-0 top-0 flex h-[50px] items-center justify-between pt-1 pr-[30px] pl-[34px] text-[15px] leading-none font-semibold text-text-primary">
					<b>9:41</b>
					<span className="inline-flex items-center gap-1.5">
						<SignalIcon />
						<WifiIcon />
						<i className="relative inline-block h-3 w-[25px] rounded-[4px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--text-primary)_45%,transparent)] after:absolute after:top-1 after:-right-[3px] after:h-1 after:w-0.5 after:rounded-r-[1px] after:bg-[color-mix(in_srgb,var(--text-primary)_45%,transparent)]">
							<i className="absolute inset-y-0.5 right-[5px] left-0.5 rounded-[2px] bg-current" />
						</i>
					</span>
				</div>
				<i className="absolute top-[11px] left-1/2 -ml-[52px] h-[31px] w-[104px] rounded-full bg-black" />
				{children}
				<i className="absolute bottom-2 left-1/2 -ml-[60px] h-[5px] w-[120px] rounded-full bg-text-primary opacity-85" />
			</div>
		</div>
	)
}
