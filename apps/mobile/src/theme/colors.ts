import { inkTheme, paperTheme, type Theme } from "@cortex/theme"

export type MobileColorScheme = "light" | "dark"

function withAlpha(hex: string, alpha: number): string {
	const value = hex.replace("#", "")
	const normalized =
		value.length === 3
			? value
					.split("")
					.map((char) => char + char)
					.join("")
			: value.slice(0, 6)
	const red = Number.parseInt(normalized.slice(0, 2), 16)
	const green = Number.parseInt(normalized.slice(2, 4), 16)
	const blue = Number.parseInt(normalized.slice(4, 6), 16)
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function createMobileColors(theme: Theme) {
	const { semantic, status, component, heading, tag, primitive } = theme.tokens
	const isDark = theme.isDark
	return {
		scheme: (isDark ? "dark" : "light") as MobileColorScheme,
		background: semantic.bg.primary,
		groupedBackground: isDark ? semantic.bg.primary : semantic.bg.secondary,
		secondaryBackground: semantic.bg.secondary,
		elevated: semantic.bg.elevated,
		cell: isDark ? semantic.bg.secondary : component.settingsGroupBg,
		fill: semantic.bg.tertiary,
		fill2: semantic.bg.active,
		hover: semantic.bg.hover,
		selected: semantic.bg.selected,
		codeBackground: semantic.bg.code,
		label: semantic.text.primary,
		secondaryLabel: semantic.text.secondary,
		tertiaryLabel: semantic.text.muted,
		mutedLabel: semantic.text.muted,
		placeholder: semantic.text.placeholder,
		disabled: semantic.text.disabled,
		tint: semantic.accent.text,
		tintFill: semantic.accent.default,
		onTint: semantic.text.onAccent,
		accentSubtle: semantic.accent.subtle,
		accentBorder: semantic.accent.border,
		link: semantic.link.default,
		separator: component.settingsGroupDivider,
		border: semantic.border.default,
		borderSubtle: semantic.border.subtle,
		borderStrong: semantic.border.strong,
		destructive: status.error,
		destructiveText: status.errorForeground,
		onDestructive: status.errorOnSolid,
		errorBackground: status.errorBg,
		success: status.success,
		successText: status.successForeground,
		successBackground: status.successBg,
		warning: status.warning,
		warningText: status.warningForeground,
		warningBackground: status.warningBg,
		tagBackground: tag.bg,
		tagText: tag.text,
		tagActiveBackground: tag.activeBg,
		tagActiveText: tag.activeText,
		sidebarBackground: component.sidebarBg,
		sidebarGuide: component.sidebarGuide,
		menuBackground: component.menuBg,
		menuBorder: component.menuBorder,
		modalBackground: component.modalBg,
		inverseSurface: component.tooltipBg,
		inverseOnSurface: component.tooltipText,
		inputBackground: component.inputBg,
		inputBorder: component.inputBorder,
		headingBlue: heading.h3Color ?? semantic.syntax.function,
		headingViolet: heading.h4Color ?? semantic.syntax.type,
		swatchGreen: primitive.green[400] ?? status.success,
		swatchYellow: primitive.yellow[400] ?? status.warning,
		swatchRed: primitive.red[400] ?? status.error,
		scrim: withAlpha(semantic.text.onAccent, isDark ? 0.52 : 0.26),
		glass: withAlpha(isDark ? semantic.bg.tertiary : semantic.bg.elevated, isDark ? 0.72 : 0.74),
		glassHighlight: withAlpha(isDark ? semantic.bg.hover : semantic.bg.active, isDark ? 0.8 : 0.7),
		glassEdge: withAlpha(isDark ? semantic.text.primary : semantic.border.default, isDark ? 0.12 : 0.7),
		shadow: withAlpha("#000000", isDark ? 0.35 : 0.12),
	}
}

export type MobileColors = ReturnType<typeof createMobileColors>

export const mobileColors: Record<MobileColorScheme, MobileColors> = {
	light: createMobileColors(paperTheme),
	dark: createMobileColors(inkTheme),
}

export function createIconColors(colors: MobileColors) {
	return { secondary: colors.tertiaryLabel, tint: colors.tint, label: colors.label }
}

export type MobileIconColors = ReturnType<typeof createIconColors>

export const mobileIconColors: Record<MobileColorScheme, MobileIconColors> = {
	light: createIconColors(mobileColors.light),
	dark: createIconColors(mobileColors.dark),
}
