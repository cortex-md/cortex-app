import { mobilePage } from "../../../content/product"
import { ProductSection, StepCards } from "../shared/layout"

export function MobileStatusSection() {
	return (
		<ProductSection>
			<StepCards title={mobilePage.stepsTitle} steps={mobilePage.steps} />
		</ProductSection>
	)
}
