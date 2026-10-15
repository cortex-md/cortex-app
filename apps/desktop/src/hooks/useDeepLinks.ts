import {
	startInviteDeepLinks,
	startResetPasswordDeepLinks,
	startSharedNoteDeepLinks,
	startTemplateDeepLinks,
} from "@cortex/core"
import { useEffect } from "react"
import { resetPasswordModal } from "../features/auth/resetPasswordModal"
import { openMarketplaceView } from "../features/marketplace/openMarketplaceView"
import { startSyncBillingDeepLinks } from "../features/sync/syncBillingDeepLink"

export function useDeepLinks(): void {
	useEffect(() => {
		const stops = [
			startSyncBillingDeepLinks(),
			startInviteDeepLinks(),
			startSharedNoteDeepLinks(),
			startResetPasswordDeepLinks((target) => resetPasswordModal.open(target)),
			startTemplateDeepLinks((selectedEntryId) =>
				openMarketplaceView("templates", { selectedEntryId }),
			),
		]
		return () => {
			for (const stop of stops) stop()
		}
	}, [])
}
