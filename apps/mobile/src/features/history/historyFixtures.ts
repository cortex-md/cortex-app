import { CURRENT_DEVICE_NAME } from "@/features/sync/syncFixtures"

export interface FixtureVersion {
	id: string
	title: string
	who: string
	device: string
	isMine: boolean
	minutesAgo: number
	content: string
}

export interface FixtureDeletedNote {
	id: string
	title: string
	folder: string
	deletedMinutesAgo: number
	who: string
	device: string
	daysLeft: number
	body: string
}

export const FIXTURE_HISTORY_NOTE_NAME = "Roadmap.md"

const VERSION_10 = `# Roadmap

What we are shipping next, and what waits.

## Now

- Property inspector: reorder
- Sync conflicts

## Next

- Templates gallery
- Mobile editor parity.`

const VERSION_11 = `# Roadmap

What we are shipping before the 1.0 release, and what waits.

## Now

- Property inspector: reorder
- Sync conflicts

## Next

- Templates gallery
- Mobile editor parity.`

const VERSION_12 = `${VERSION_11}

## Later

- Mobile editor parity.`

const VERSION_13 = `# Roadmap

What we are shipping before the 1.0 release, and what waits.

## Now

- Marketplace updates badge and release dates
- Property inspector: sort options manually
- Sync conflicts

## Next

- Templates gallery
- Mobile editor parity and community theme previews.

## Later

- Conflict view for sync`

const CURRENT = VERSION_13.replace(
	"- Conflict view for sync",
	"- Conflict view for sync, with Keep Local and Keep Remote",
)

const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES

export const FIXTURE_VERSIONS: FixtureVersion[] = [
	{
		id: "fixture-current",
		title: "Current version",
		who: "Ana Moreira",
		device: "MacBook Pro",
		isMine: false,
		minutesAgo: 20,
		content: CURRENT,
	},
	{
		id: "fixture-13",
		title: "Version 13",
		who: "Ana Moreira",
		device: CURRENT_DEVICE_NAME,
		isMine: true,
		minutesAgo: 107,
		content: VERSION_13,
	},
	{
		id: "fixture-12",
		title: "Version 12",
		who: "Bruno Kim",
		device: "MacBook Air",
		isMine: false,
		minutesAgo: DAY_MINUTES + 4 * HOUR_MINUTES,
		content: VERSION_12,
	},
	{
		id: "fixture-11",
		title: "Version 11",
		who: "Ana Moreira",
		device: "MacBook Pro",
		isMine: false,
		minutesAgo: DAY_MINUTES + 11 * HOUR_MINUTES,
		content: VERSION_11,
	},
	{
		id: "fixture-10",
		title: "Version 10",
		who: "Ana Moreira",
		device: "MacBook Pro",
		isMine: false,
		minutesAgo: 7 * DAY_MINUTES,
		content: VERSION_10,
	},
]

export const FIXTURE_DELETED_NOTES: FixtureDeletedNote[] = [
	{
		id: "deleted-old-plan",
		title: "Old plan",
		folder: "Projects/Cortex",
		deletedMinutesAgo: 60,
		who: "Ana Moreira",
		device: "MacBook Pro",
		daysLeft: 29,
		body: "# Old plan\n\nShip sync before templates. Superseded by the Roadmap note.\n\n- Sync beta with ten testers\n- Templates after 1.0",
	},
	{
		id: "deleted-meeting",
		title: "Meeting 2026-10-08",
		folder: "Daily",
		deletedMinutesAgo: 150,
		who: "Ana Moreira",
		device: CURRENT_DEVICE_NAME,
		daysLeft: 29,
		body: "# Meeting 2026-10-08\n\n- Reviewed the sync conflict view\n- Bruno owns the marketplace badge",
	},
	{
		id: "deleted-clippings",
		title: "Clippings draft",
		folder: "Reading",
		deletedMinutesAgo: DAY_MINUTES + 6 * HOUR_MINUTES,
		who: "Carla Lima",
		device: "iPad",
		daysLeft: 28,
		body: "# Clippings draft\n\nArticles to file under Reading.",
	},
	{
		id: "deleted-sync-spike",
		title: "Sync spike",
		folder: "Projects/Cortex/Archive",
		deletedMinutesAgo: 27 * DAY_MINUTES,
		who: "Ana Moreira",
		device: "MacBook Pro",
		daysLeft: 3,
		body: "# Sync spike\n\nCRDT prototype notes. Kept for reference.",
	},
]
