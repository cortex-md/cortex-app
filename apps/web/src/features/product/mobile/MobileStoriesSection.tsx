import { mobilePage } from "../../../content/product"
import { ProductSection, SplitStory } from "../shared/layout"

export function MobileStoriesSection() {
	return (
		<>
			{mobilePage.stories.map((story) => (
				<ProductSection key={story.title}>
					<SplitStory title={story.title} body={story.body} points={story.points} />
				</ProductSection>
			))}
		</>
	)
}
