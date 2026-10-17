import { cliPage } from "../../../content/product"
import { ProductSection, SplitStory } from "../shared/layout"

const [develop, ship] = cliPage.stories

export function CliStoriesSection() {
	return (
		<>
			<ProductSection>
				<SplitStory
					title={develop.title}
					body={
						<>
							<code className="font-mono text-[14px]">{develop.code}</code>
							{develop.body}
						</>
					}
					points={develop.points}
				/>
			</ProductSection>
			<ProductSection>
				<SplitStory title={ship.title} body={ship.body} points={ship.points} />
			</ProductSection>
		</>
	)
}
