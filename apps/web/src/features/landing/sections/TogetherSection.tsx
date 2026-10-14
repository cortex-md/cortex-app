import { togetherGroup } from "../../../content/landing"
import { FeatureStory, PaintedVisual } from "../components/FeatureStory"
import { GroupHeading, HomeSection } from "../components/HomeLayout"
import { CollaborationMock } from "../components/mocks/CollaborationMock"

export function TogetherSection() {
	return (
		<HomeSection id={togetherGroup.id} aria-labelledby="together-title">
			<GroupHeading
				headingId="together-title"
				title={togetherGroup.title}
				quiet={togetherGroup.quiet}
				description={togetherGroup.description}
			/>
			<FeatureStory
				copy={togetherGroup.collaboration}
				visual={
					<PaintedVisual
						painting="coast"
						position="center 55%"
						label="A shared note with live cursors from three editors and an anchored comment"
					>
						<CollaborationMock />
					</PaintedVisual>
				}
			/>
		</HomeSection>
	)
}
