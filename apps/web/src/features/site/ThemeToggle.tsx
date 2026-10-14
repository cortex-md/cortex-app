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
				"relative inline-grid size-9 shrink-0 place-items-center rounded-lg text-text-secondary outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-site-hover hover:text-text-primary focus-visible:shadow-focus active:scale-[0.96] max-sm:size-10 motion-reduce:active:scale-100",
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
