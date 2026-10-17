import { keepGroup } from "../../../content/landing"
import { FeatureStory, PaintedVisual } from "../components/FeatureStory"
import { GroupHeading, HomeSection } from "../components/HomeLayout"
import { HistoryMock } from "../components/mocks/HistoryMock"
import { ObsidianMock } from "../components/mocks/ObsidianMock"

export function KeepSection() {
	return (
		<HomeSection id={keepGroup.id} aria-labelledby="keep-title">
			<GroupHeading
				headingId="keep-title"
				title={keepGroup.title}
				quiet={keepGroup.quiet}
				description={keepGroup.description}
			/>
			<FeatureStory
				copy={keepGroup.history}
				visual={
					<PaintedVisual
						painting="mist"
						position="center 55%"
						label="Version history comparing versions of a note, with a restore button"
					>
						<HistoryMock />
					</PaintedVisual>
				}
			/>
			<FeatureStory
				copy={keepGroup.obsidian}
				reverse
				visual={
					<PaintedVisual
						painting="dusk"
						position="center 60%"
						label="An Obsidian vault being copied into a Cortex vault, folder by folder"
					>
						<ObsidianMock />
					</PaintedVisual>
				}
			/>
		</HomeSection>
	)
}
