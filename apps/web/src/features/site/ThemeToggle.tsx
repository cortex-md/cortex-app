import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { applySiteTheme, getCurrentSiteTheme, type SiteTheme } from "./theme"

interface ThemeToggleProps {
	className?: string
}

function getNextTheme(theme: SiteTheme): SiteTheme {
	return theme === "dark" ? "light" : "dark"
}

export function ThemeToggle({ className }: ThemeToggleProps) {
	const [theme, setTheme] = useState<SiteTheme>("light")

	useEffect(() => {
		const currentTheme = getCurrentSiteTheme()
		applySiteTheme(currentTheme, false)
		setTheme(currentTheme)

		function handleThemeChange(event: Event) {
			const detail = (event as CustomEvent<{ theme?: SiteTheme }>).detail
			if (detail?.theme) setTheme(detail.theme)
		}

		function handleStorage(event: StorageEvent) {
			if (event.key === "cortex-theme") setTheme(getCurrentSiteTheme())
		}

		window.addEventListener("cortex-theme-change", handleThemeChange)
		window.addEventListener("storage", handleStorage)
		return () => {
			window.removeEventListener("cortex-theme-change", handleThemeChange)
			window.removeEventListener("storage", handleStorage)
		}
	}, [])

	const nextTheme = getNextTheme(theme)

	return (
		<button
			className={[
				"relative inline-grid size-10 shrink-0 place-items-center rounded-lg text-text-secondary transition-[background-color,color,scale] duration-150 ease-out hover:bg-bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.96]",
				className,
			]
				.filter(Boolean)
				.join(" ")}
			type="button"
			aria-label={`Switch to ${nextTheme} theme`}
			aria-pressed={theme === "dark"}
			onClick={() => {
				applySiteTheme(nextTheme)
				setTheme(nextTheme)
			}}
		>
			<Sun
				className={[
					"absolute size-4 transition-[opacity,scale,filter] duration-200 ease-out",
					theme === "dark" ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0",
				].join(" ")}
				aria-hidden="true"
			/>
			<Moon
				className={[
					"absolute size-4 transition-[opacity,scale,filter] duration-200 ease-out",
					theme === "dark" ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]",
				].join(" ")}
				aria-hidden="true"
			/>
		</button>
	)
}
