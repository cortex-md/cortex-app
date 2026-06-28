import { ProductMedia } from "../components/ProductMedia"
import { SectionHeading } from "../components/SectionHeading"

export function OrganizationSection() {
	return (
		<section className="scroll-mt-44" id="organize">
			<div className="mx-auto w-[min(1180px,calc(100%_-_64px))] py-24 max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-md:py-[80px] max-sm:w-[min(calc(100%_-_28px),520px)] max-sm:py-[68px]">
				<SectionHeading
					title="Structure that adapts to how you already think."
					description="Choose folders when the hierarchy is obvious, tags when relationships matter, and bookmarks when a note needs to stay one gesture away."
				/>
				<ProductMedia
					label="Organization workflow"
					width={1648}
					height={900}
					fit="contain"
					description="Cortex organization workspace with folders, tags, bookmarks, and note properties."
					alt="Cortex organization workspace showing folders, tags, bookmarks, and note properties."
					src="/media/organize.png"
					webpSrc="/media/organize.webp"
				/>
			</div>
		</section>
	)
}
