import type { RegisteredSettingsPage } from "@cortex/plugin-host-core"
import { Activity, type ComponentType, useState } from "react"
import type { OpenMarketplaceHandler } from "../marketplace/openMarketplaceView"
import type { CoreSettingsPageProps } from "./coreSettingsPages"
import { PluginSettingsPage } from "./PluginSettingsPage"
import { SettingsPageHeader } from "./SettingsPrimitives"

interface SettingsPageHostProps {
	pages: RegisteredSettingsPage[]
	activeKey: string
	onOpenMarketplace: OpenMarketplaceHandler
}

function SettingsPageContent({
	page,
	onOpenMarketplace,
}: {
	page: RegisteredSettingsPage
	onOpenMarketplace: OpenMarketplaceHandler
}) {
	if (!page.component) return <PluginSettingsPage page={page} />
	const PageComponent = page.component as ComponentType<CoreSettingsPageProps>
	return <PageComponent onOpenMarketplace={onOpenMarketplace} />
}

export function SettingsPageHost({ pages, activeKey, onOpenMarketplace }: SettingsPageHostProps) {
	const [visitedKeys, setVisitedKeys] = useState<string[]>([activeKey])
	if (!visitedKeys.includes(activeKey)) setVisitedKeys([...visitedKeys, activeKey])

	return visitedKeys.map((key) => {
		const page = pages.find((candidate) => candidate.key === key)
		if (!page) return null
		return (
			<Activity key={key} mode={key === activeKey ? "visible" : "hidden"}>
				<div className="settings-page-scroll" data-page-key={key}>
					<div className="settings-page-body">
						<SettingsPageHeader title={page.title} description={page.description} />
						<SettingsPageContent page={page} onOpenMarketplace={onOpenMarketplace} />
					</div>
				</div>
			</Activity>
		)
	})
}
