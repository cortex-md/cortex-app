export interface ConflictBannerViewProps {
	busy: boolean
	onCompare: () => void
	onKeepMine: () => void
	onKeepTheirs: () => void
}

export const CONFLICT_BANNER_TITLE = "Sync conflict"
export const CONFLICT_BANNER_MESSAGE = "This note changed here and on another device."
