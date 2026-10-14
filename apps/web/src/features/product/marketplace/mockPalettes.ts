import type React from "react"

export type MockPalette = "paper" | "gruv"

export const mockPalettes: Record<MockPalette, React.CSSProperties> = {
	paper: {
		"--m-bg": "#fcfcfb",
		"--m-side": "#f6f5f3",
		"--m-card": "#ffffff",
		"--m-hover": "#eeece9",
		"--m-fg": "#1c1917",
		"--m-2": "#57534e",
		"--m-mute": "#8a847d",
		"--m-line": "#e8e5e1",
		"--m-acc": "#e11d48",
		"--m-acc-fg": "#ffffff",
	} as React.CSSProperties,
	gruv: {
		"--m-bg": "#1d2021",
		"--m-side": "#282828",
		"--m-card": "#32302f",
		"--m-hover": "#3c3836",
		"--m-fg": "#ebdbb2",
		"--m-2": "#d5c4a1",
		"--m-mute": "#a89984",
		"--m-line": "#504945",
		"--m-acc": "#fabd2f",
		"--m-acc-fg": "#1d2021",
	} as React.CSSProperties,
}

export const swatchClasses = {
	paper: "bg-[linear-gradient(135deg,#fcfcfb_50%,#e11d48_50%)]",
	ink: "bg-[linear-gradient(135deg,#f5f5f7_50%,#303342_50%)]",
	gruv: "bg-[linear-gradient(135deg,#282828_50%,#fabd2f_50%)]",
} as const
