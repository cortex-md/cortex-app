import { startTemplateDeepLinks } from "@cortex/core"
import { useEffect } from "react"
import { openMarketplaceView } from "../marketplace/openMarketplaceView"

export { parseTemplateDeepLink, TEMPLATE_LINK_ENTRY_PREFIX } from "@cortex/core"

export function useTemplateDeepLink(): void {
	useEffect(
		() =>
			startTemplateDeepLinks((selectedEntryId) =>
				openMarketplaceView("templates", { selectedEntryId }),
			),
		[],
	)
}
