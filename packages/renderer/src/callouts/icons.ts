const CIRCLE = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"

export const CALLOUT_ICON_PATHS: Readonly<Record<string, readonly string[]>> = {
	pencil: [
		"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
		"m15 5 4 4",
	],
	"clipboard-list": [
		"M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
		"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
		"M12 11h4M12 16h4M8 11h.01M8 16h.01",
	],
	info: [CIRCLE, "M12 16v-4M12 8h.01"],
	"circle-check": [CIRCLE, "m9 12 2 2 4-4"],
	flame: [
		"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
	],
	check: ["M20 6 9 17l-5-5"],
	"circle-help": [CIRCLE, "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"],
	"triangle-alert": [
		"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
		"M12 9v4M12 17h.01",
	],
	x: ["M18 6 6 18M6 6l12 12"],
	zap: [
		"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
	],
	bug: [
		"m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1",
		"M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9",
		"M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4",
	],
	list: ["M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"],
	quote: [
		"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
		"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
	],
}

export const DEFAULT_CALLOUT_ICON = "pencil"

export function getCalloutIconPaths(icon: string | undefined): readonly string[] {
	return (
		CALLOUT_ICON_PATHS[icon ?? DEFAULT_CALLOUT_ICON] ??
		(CALLOUT_ICON_PATHS[DEFAULT_CALLOUT_ICON] as readonly string[])
	)
}
