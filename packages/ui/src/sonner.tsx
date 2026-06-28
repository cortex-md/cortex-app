"use client"

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ theme = "system", ...props }: ToasterProps) => {
	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "color-mix(in srgb, var(--popover) 84%, transparent)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "color-mix(in srgb, var(--border) 70%, transparent)",
					"--border-radius": "10px",
				} as React.CSSProperties
			}
			{...props}
		/>
	)
}

export { Toaster }
