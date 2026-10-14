import { marketplacePage, noteCapabilityLabels } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { FeatureStory, MockFigure, ProductSection } from "../shared/layout"

const { permissions } = marketplacePage

function ManifestCard() {
	const last = permissions.capabilities.length - 1

	return (
		<div className="absolute top-[50px] left-8 z-[1] w-[290px] rounded-2xl bg-[rgba(28,25,23,0.92)] pb-3.5 text-left text-[#e7e5e4] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.55)]">
			<div className="border-b border-white/[0.08] px-4 py-[11px] text-[12px] leading-none font-medium text-[#a8a29e]">
				{permissions.manifestFile}
			</div>
			<pre className="m-0 px-4 pt-3 font-mono text-[12.5px] leading-5 whitespace-pre">
				{"{\n  "}
				<span className="text-[#fda4af]">"id"</span>:{" "}
				<span className="text-[#86efac]">"{permissions.pluginId}"</span>
				{",\n  "}
				<span className="text-[#fda4af]">"name"</span>:{" "}
				<span className="text-[#86efac]">"{permissions.pluginName}"</span>
				{",\n  "}
				<span className="text-[#fda4af]">"capabilities"</span>
				{": [\n"}
				{permissions.capabilities.map((capability, index) => (
					<span key={capability}>
						{"    "}
						<span
							className="rounded text-[#86efac] animate-product-capability motion-reduce:animate-none"
							style={{ animationDelay: `${index * 0.45}s` }}
						>
							"{capability}"
						</span>
						{index < last ? ",\n" : "\n"}
					</span>
				))}
				{"  ]\n}"}
			</pre>
		</div>
	)
}

function EnableDialog() {
	return (
		<div className="absolute top-[34px] right-8 z-[1] w-[330px] rounded-2xl bg-[color-mix(in_srgb,var(--bg-primary)_94%,transparent)] p-5 text-left shadow-lift backdrop-blur-[14px]">
			<b className="text-[16px] leading-[1.2] font-semibold">{permissions.dialogTitle}</b>
			<p className="mt-2 mb-2.5 text-[13.5px] leading-[1.4] text-text-secondary">
				{permissions.dialogLead}
			</p>
			<ul className="m-0 grid list-none gap-0.5 p-0">
				{permissions.capabilities.map((capability, index) => (
					<li
						key={capability}
						className="flex items-center gap-2.5 rounded-[7px] px-2 py-[5px] text-[13px] leading-[1.2] opacity-35 animate-product-permission motion-reduce:animate-none motion-reduce:opacity-100"
						style={{ animationDelay: `${index * 0.45}s` }}
					>
						<i className="size-1.5 rounded-full bg-brand" />
						{noteCapabilityLabels[capability] ?? capability}
					</li>
				))}
			</ul>
			<small className="mt-3 block text-[12px] leading-[1.45] text-text-muted">
				{permissions.dialogWarning}
			</small>
			<div className="mt-3.5 flex justify-end gap-2 text-[13px] leading-none font-medium">
				<span className="rounded-lg px-[13px] py-[7px] shadow-[inset_0_0_0_1px_var(--site-sep)]">
					{permissions.cancel}
				</span>
				<span className="rounded-lg bg-brand px-[13px] py-[7px] text-text-on-accent">
					{permissions.enable}
				</span>
			</div>
		</div>
	)
}

export function MarketplacePermissionsSection() {
	return (
		<ProductSection>
			<FeatureStory
				title={permissions.title}
				body={permissions.body}
				points={permissions.points}
				visual={
					<MockFigure
						label={permissions.alt}
						className="relative isolate h-[500px] overflow-hidden rounded-[28px] max-sm:w-[620px] max-sm:rounded-[40px] max-sm:[zoom:0.565]"
					>
						<Painting name="meadow" position="center 60%" />
						<ManifestCard />
						<EnableDialog />
					</MockFigure>
				}
			/>
		</ProductSection>
	)
}
