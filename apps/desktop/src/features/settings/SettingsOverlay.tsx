import { getPlatform } from "@cortex/platform"
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@cortex/ui"
import { XIcon } from "lucide-react"
import { useCallback, useEffect } from "react"
import type { OpenMarketplaceHandler } from "../marketplace/openMarketplaceView"
import { openMarketplaceView } from "../marketplace/openMarketplaceView"
import { type SettingsNavigateHandler, SettingsView } from "./SettingsView"
import { closeSettings, openSettings, settingsModal } from "./settingsModal"

const openMarketplace: OpenMarketplaceHandler = (tab, options) => {
	closeSettings()
	openMarketplaceView(tab, options)
}

function handleOpenChange(open: boolean): void {
	if (!open) closeSettings()
}

function prefetchSystemFonts(): () => void {
	const idleId = window.requestIdleCallback(() => {
		void getPlatform()
			.font.listSystemFonts()
			.catch(() => {})
	})
	return () => window.cancelIdleCallback(idleId)
}

export function SettingsOverlayHost() {
	const target = settingsModal.useTarget()
	const navigate = useCallback<SettingsNavigateHandler>(
		(section, fieldId, focus = false, fallbackId) =>
			openSettings(section, fieldId, { focus, fallbackId }),
		[],
	)

	useEffect(() => (target ? prefetchSystemFonts() : undefined), [target])

	return (
		<Dialog open={target !== null} onOpenChange={handleOpenChange}>
			<DialogContent
				className="settings-overlay"
				motion="fade"
				showCloseButton={false}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>Configure Cortex</DialogDescription>
				</DialogHeader>
				<div className="settings-overlay-titlebar">
					<span>Settings</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Close settings"
						onClick={closeSettings}
					>
						<XIcon />
					</Button>
				</div>
				{target && (
					<SettingsView target={target} onNavigate={navigate} onOpenMarketplace={openMarketplace} />
				)}
			</DialogContent>
		</Dialog>
	)
}
