import { usePluginStore } from "@cortex/plugin-host-core"
import { useMemo } from "react"
import type { OpenMarketplaceHandler } from "../marketplace/openMarketplaceView"
import { CORE_SETTINGS_PAGES } from "./coreSettingsPageRegistry"
import { SettingsNav } from "./SettingsNav"
import { SettingsPageHost } from "./SettingsPageHost"
import {
	SettingsRevealContext,
	type SettingsRevealTarget,
	useRevealSettingsField,
} from "./settingsReveal"

export type SettingsNavigateHandler = (
	section: string,
	fieldId?: string,
	focus?: boolean,
	fallbackId?: string,
) => void

interface SettingsViewProps {
	target: SettingsRevealTarget
	onNavigate: SettingsNavigateHandler
	onOpenMarketplace: OpenMarketplaceHandler
}

export function SettingsView({ target, onNavigate, onOpenMarketplace }: SettingsViewProps) {
	const pluginPages = usePluginStore((state) => state.settingsPages)
	const pages = useMemo(() => [...CORE_SETTINGS_PAGES, ...pluginPages], [pluginPages])
	const activeKey = pages.some((page) => page.key === target.section) ? target.section : "general"
	useRevealSettingsField(target)

	return (
		<SettingsRevealContext value={target}>
			<div className="settings-content">
				<SettingsNav pages={pages} activeKey={activeKey} onNavigate={onNavigate} />
				<main className="settings-main">
					<SettingsPageHost
						pages={pages}
						activeKey={activeKey}
						onOpenMarketplace={onOpenMarketplace}
					/>
				</main>
			</div>
		</SettingsRevealContext>
	)
}
