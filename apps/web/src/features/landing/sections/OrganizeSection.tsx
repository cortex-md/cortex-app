import { organizeGroup } from "../../../content/landing"
import { FeatureStory, PaintedVisual } from "../components/FeatureStory"
import { GroupHeading, HomeSection } from "../components/HomeLayout"
import { DatabaseMock } from "../components/mocks/DatabaseMock"
import { TasksMock } from "../components/mocks/TasksMock"

export function OrganizeSection() {
	return (
		<HomeSection id={organizeGroup.id} aria-labelledby="organize-title">
			<GroupHeading
				headingId="organize-title"
				title={organizeGroup.title}
				quiet={organizeGroup.quiet}
				description={organizeGroup.description}
			/>
			<FeatureStory
				copy={organizeGroup.databases}
				visual={
					<PaintedVisual
						painting="meadow"
						position="center 60%"
						label="A Projects database switching between table, board and gallery views"
					>
						<DatabaseMock />
					</PaintedVisual>
				}
			/>
			<FeatureStory
				copy={organizeGroup.tasks}
				reverse
				visual={
					<PaintedVisual
						painting="wheat"
						position="center 65%"
						label="The Today view with tasks, a repeating reminder and a natural-language task field"
					>
						<TasksMock />
					</PaintedVisual>
				}
			/>
		</HomeSection>
	)
}
