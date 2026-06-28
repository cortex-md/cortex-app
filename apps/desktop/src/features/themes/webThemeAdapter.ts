import type { ThemeAdapter } from "@cortex/theme"

const THEME_CLASS_REGEX = /(?:^|\s)theme-[\w-]+(?=\s|$)/g
const OVERRIDE_STYLE_ID = "cortex-theme-overrides"

export class WebThemeAdapter implements ThemeAdapter {
	applyTheme(themeName: string, colorScheme: "light" | "dark"): void {
		document.body.className = document.body.className.replace(THEME_CLASS_REGEX, "").trim()
		document.body.classList.add(`theme-${themeName}`)
		document.body.dataset.themeScheme = colorScheme
	}

	injectCSS(cssString: string, themeName: string): void {
		const existing = document.querySelector(`style[data-theme="${themeName}"]`)
		if (existing) {
			existing.textContent = cssString
			return
		}
		const style = document.createElement("style")
		style.textContent = cssString
		style.setAttribute("data-theme", themeName)
		document.head.appendChild(style)
	}

	removeCSS(themeName: string): void {
		const existing = document.querySelector(`style[data-theme="${themeName}"]`)
		if (existing) existing.remove()
	}

	applyOverrides(overrides: Record<string, string>): void {
		if (Object.keys(overrides).length === 0) {
			this.clearOverrides()
			return
		}

		let style = document.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null
		if (!style) {
			style = document.createElement("style")
			style.id = OVERRIDE_STYLE_ID
			document.head.appendChild(style)
		}

		const declarations = Object.entries(overrides)
			.map(([prop, value]) => `  ${prop}: ${value} !important;`)
			.join("\n")

		style.textContent = `body {\n${declarations}\n}`
	}

	clearOverrides(): void {
		const style = document.getElementById(OVERRIDE_STYLE_ID)
		if (style) style.remove()
	}
}
