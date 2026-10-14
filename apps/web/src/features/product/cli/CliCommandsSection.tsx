import { cliPage } from "../../../content/product"
import { ProductSection, StepCards } from "../shared/layout"

export function CliCommandsSection() {
	return (
		<ProductSection>
			<StepCards title={cliPage.stepsTitle} steps={cliPage.steps} />
		</ProductSection>
	)
}
