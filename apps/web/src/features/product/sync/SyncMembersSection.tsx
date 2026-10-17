import { syncPage } from "../../../content/product"
import { CortexMark } from "../../site/CortexMark"
import { Painting } from "../../site/Painting"
import { FeatureStory, MockFigure, ProductSection } from "../shared/layout"

const { members } = syncPage
const spokeDelays = [0.6, 0, 0, 0.6]
const glassCard =
	"bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] shadow-lift backdrop-blur-[12px]"

function VaultOrbit() {
	return (
		<MockFigure
			label={members.alt}
			className="relative isolate h-[460px] overflow-hidden rounded-[28px] max-sm:w-[620px] max-sm:rounded-[40px] max-sm:[zoom:0.565]"
		>
			<Painting name="dusk" position="center 55%" />
			<div className="absolute top-1/2 left-1/2 z-[1] -mt-[165px] -ml-[165px] size-[330px] rounded-full border-[1.5px] border-dashed border-white/55 animate-product-spin motion-reduce:animate-none" />
			<div
				className={`absolute top-1/2 left-1/2 z-[2] -mt-16 -ml-16 flex w-32 flex-col items-center gap-1 rounded-[26px] pt-[18px] pb-3.5 ${glassCard}`}
			>
				<CortexMark className="size-10" size={40} />
				<b className="text-[15px] leading-[1.2] font-semibold">{members.vault}</b>
				<small className="text-[12px] leading-none font-medium text-status-success-foreground">
					{members.vaultStatus}
				</small>
			</div>
			{members.satellites.map((satellite, index) => (
				<div key={satellite.name} className="contents">
					<div
						className="absolute top-1/2 left-1/2 z-[1] h-0.5 w-[165px] origin-[0_50%]"
						style={{ transform: `rotate(${satellite.angle}deg)` }}
					>
						<i
							className="absolute -top-[3px] left-[60px] size-2 rounded-full bg-white opacity-0 shadow-[0_0_10px_2px_rgba(255,255,255,0.8)] animate-product-pulse motion-reduce:hidden"
							style={{ animationDelay: `${spokeDelays[index] ?? 0}s` }}
						/>
					</div>
					<div
						className={`absolute top-1/2 left-1/2 z-[2] grid grid-cols-[30px_auto] grid-rows-[auto_auto] items-center gap-x-2.5 rounded-2xl py-[9px] pr-3.5 pl-[9px] text-left whitespace-nowrap ${glassCard}`}
						style={{
							transform: `translate(-50%, -50%) rotate(${satellite.angle}deg) translateX(200px) rotate(${-satellite.angle}deg)`,
						}}
					>
						<span className="row-span-2 inline-flex size-[30px] items-center justify-center rounded-full bg-brand text-[10px] leading-none font-semibold text-white">
							{satellite.initials}
						</span>
						<b className="text-[13px] leading-[1.2] font-medium">{satellite.name}</b>
						<small className="text-[11.5px] leading-[1.2] text-text-muted">
							{satellite.detail}
						</small>
					</div>
				</div>
			))}
		</MockFigure>
	)
}

export function SyncMembersSection() {
	return (
		<ProductSection>
			<FeatureStory
				title={members.title}
				body={members.body}
				points={members.points}
				visual={<VaultOrbit />}
			/>
		</ProductSection>
	)
}
