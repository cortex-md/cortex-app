import type { Theme } from "./types"

const defaultMarkdownCodeFontFamily =
	'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
const defaultMarkdownCodeFontSize = "14px"

function emitColorScale(
	vars: Record<string, string>,
	scale: Record<string, string>,
	...prefixes: string[]
): void {
	Object.entries(scale).forEach(([key, value]) => {
		prefixes.forEach((prefix) => {
			vars[`--${prefix}-${key}`] = value
		})
	})
}

export function generateCSSVariables(theme: Theme): Record<string, string> {
	const vars: Record<string, string> = {}
	const t = theme.tokens

	emitColorScale(vars, t.primitive.stone, "stone", "mist")
	emitColorScale(vars, t.primitive.ink, "ink", "slate")
	emitColorScale(vars, t.primitive.amber, "amber", "rose")
	emitColorScale(vars, t.primitive.amberDark, "amber-d", "rose-d")
	emitColorScale(vars, t.primitive.red, "red")
	emitColorScale(vars, t.primitive.green, "green")
	emitColorScale(vars, t.primitive.yellow, "yellow")

	vars["--bg-primary"] = t.semantic.bg.primary
	vars["--bg-secondary"] = t.semantic.bg.secondary
	vars["--bg-tertiary"] = t.semantic.bg.tertiary
	vars["--bg-elevated"] = t.semantic.bg.elevated
	vars["--bg-hover"] = t.semantic.bg.hover
	vars["--bg-active"] = t.semantic.bg.active
	vars["--bg-selected"] = t.semantic.bg.selected
	vars["--bg-code"] = t.semantic.bg.code
	vars["--bg-tag"] = t.semantic.bg.tag
	vars["--editor-selection-bg"] = t.semantic.selection?.background ?? t.semantic.bg.selected
	vars["--editor-search-match-bg"] = t.semantic.selection?.searchMatch ?? t.semantic.accent.subtle
	vars["--editor-search-match-active-bg"] =
		t.semantic.selection?.searchMatchActive ?? t.semantic.bg.selected

	vars["--text-primary"] = t.semantic.text.primary
	vars["--text-secondary"] = t.semantic.text.secondary
	vars["--text-muted"] = t.semantic.text.muted
	vars["--text-disabled"] = t.semantic.text.disabled
	vars["--text-placeholder"] = t.semantic.text.placeholder
	vars["--text-on-accent"] = t.semantic.text.onAccent

	vars["--accent"] = t.semantic.accent.default
	vars["--accent-hover"] = t.semantic.accent.hover
	vars["--accent-active"] = t.semantic.accent.active
	vars["--accent-subtle"] = t.semantic.accent.subtle
	vars["--accent-border"] = t.semantic.accent.border
	vars["--accent-text"] = t.semantic.accent.text
	vars["--brand"] = t.semantic.accent.default
	vars["--brand-hover"] = t.semantic.accent.hover
	vars["--brand-active"] = t.semantic.accent.active
	vars["--brand-subtle"] = t.semantic.accent.subtle
	vars["--brand-border"] = t.semantic.accent.border
	vars["--brand-text"] = t.semantic.accent.text

	vars["--link"] = t.semantic.link.default
	vars["--link-hover"] = t.semantic.link.hover
	vars["--link-broken"] = t.semantic.link.broken

	vars["--border"] = t.semantic.border.default
	vars["--border-subtle"] = t.semantic.border.subtle
	vars["--border-strong"] = t.semantic.border.strong
	vars["--border-focus"] = t.semantic.border.focus

	vars["--syntax-keyword"] = t.semantic.syntax.keyword
	vars["--syntax-string"] = t.semantic.syntax.string
	vars["--syntax-comment"] = t.semantic.syntax.comment
	vars["--syntax-number"] = t.semantic.syntax.number
	vars["--syntax-function"] = t.semantic.syntax.function
	vars["--syntax-type"] = t.semantic.syntax.type
	vars["--syntax-operator"] = t.semantic.syntax.operator
	vars["--syntax-property"] = t.semantic.syntax.property
	vars["--syntax-heading"] = t.semantic.syntax.heading
	vars["--syntax-meta"] = t.semantic.syntax.meta

	vars["--font-ui"] = t.fonts.ui
	vars["--font-editor"] = t.fonts.editor
	vars["--font-mono"] = t.fonts.mono
	vars["--ui-font-weight"] = t.typography.ui.fontWeight
	vars["--ui-line-height"] = t.typography.ui.lineHeight
	vars["--editor-font-weight"] = t.typography.editor.fontWeight
	vars["--editor-line-height"] = t.typography.editor.lineHeight

	vars["--status-error"] = t.status.error
	vars["--error-bg"] = t.status.errorBg
	vars["--status-error-foreground"] = t.status.errorForeground
	vars["--status-error-border"] = t.status.errorBorder
	vars["--status-error-on-solid"] = t.status.errorOnSolid
	vars["--status-success"] = t.status.success
	vars["--success-bg"] = t.status.successBg
	vars["--status-success-foreground"] = t.status.successForeground
	vars["--status-success-border"] = t.status.successBorder
	vars["--status-success-on-solid"] = t.status.successOnSolid
	vars["--status-warning"] = t.status.warning
	vars["--warning-bg"] = t.status.warningBg
	vars["--status-warning-foreground"] = t.status.warningForeground
	vars["--status-warning-border"] = t.status.warningBorder
	vars["--status-warning-on-solid"] = t.status.warningOnSolid
	const fallbackCallouts = {
		note: { color: t.semantic.accent.default, backgroundColor: t.semantic.accent.subtle },
		abstract: { color: t.semantic.text.secondary, backgroundColor: t.semantic.bg.secondary },
		info: { color: t.semantic.link.default, backgroundColor: t.semantic.accent.subtle },
		todo: { color: t.semantic.accent.default, backgroundColor: t.semantic.accent.subtle },
		tip: { color: t.status.success, backgroundColor: t.status.successBg },
		success: { color: t.status.success, backgroundColor: t.status.successBg },
		question: { color: t.status.warning, backgroundColor: t.status.warningBg },
		warning: { color: t.status.warning, backgroundColor: t.status.warningBg },
		failure: { color: t.status.error, backgroundColor: t.status.errorBg },
		danger: { color: t.status.error, backgroundColor: t.status.errorBg },
		bug: { color: t.status.error, backgroundColor: t.status.errorBg },
		example: { color: t.semantic.syntax.function, backgroundColor: t.semantic.bg.secondary },
		quote: { color: t.semantic.text.muted, backgroundColor: t.semantic.bg.secondary },
	}
	const callouts = t.markdown?.callouts ?? fallbackCallouts
	for (const [type, callout] of Object.entries(callouts)) {
		vars[`--callout-${type}-color`] = callout.color
		vars[`--callout-${type}-bg`] = callout.backgroundColor
	}

	vars["--btn-primary-bg"] = t.component.btnPrimaryBg
	vars["--btn-primary-text"] = t.component.btnPrimaryText
	vars["--btn-primary-hover"] = t.component.btnPrimaryHover
	vars["--input-bg"] = t.component.inputBg
	vars["--input-border"] = t.component.inputBorder
	vars["--input-focus-ring"] = t.component.inputFocusRing
	vars["--menu-bg"] = t.component.menuBg
	vars["--menu-border"] = t.component.menuBorder
	vars["--menu-shadow"] = t.component.menuShadow
	vars["--menu-hover"] = t.component.menuHover
	vars["--modal-bg"] = t.component.modalBg
	vars["--modal-border"] = t.component.modalBorder
	vars["--modal-shadow"] = t.component.modalShadow
	vars["--tooltip-bg"] = t.component.tooltipBg
	vars["--tooltip-text"] = t.component.tooltipText
	vars["--sidebar-bg"] = t.component.sidebarBg
	vars["--sidebar-border"] = t.component.sidebarBorder
	vars["--sidebar-tree-guide"] = t.component.sidebarGuide
	vars["--settings-group-bg"] = t.component.settingsGroupBg
	vars["--settings-group-border"] = t.component.settingsGroupBorder
	vars["--settings-group-divider"] = t.component.settingsGroupDivider
	vars["--tab-bg"] = t.component.tabBg
	vars["--tab-active-bg"] = t.component.tabActiveBg
	vars["--tab-accent"] = t.component.tabAccent
	vars["--statusbar-bg"] = t.component.statusbarBg
	vars["--statusbar-border"] = t.component.statusbarBorder
	vars["--scrollbar-thumb"] = t.component.scrollbarThumb
	vars["--scrollbar-hover"] = t.component.scrollbarHover
	vars["--shadow-raised"] = t.component.shadowRaised
	vars["--shadow-floating"] = t.component.shadowFloating
	vars["--shadow-overlay"] = t.component.shadowOverlay

	vars["--background"] = t.semantic.bg.primary
	vars["--foreground"] = t.semantic.text.primary
	vars["--card"] = t.semantic.bg.elevated
	vars["--card-foreground"] = t.semantic.text.primary
	vars["--popover"] = t.component.menuBg
	vars["--popover-foreground"] = t.semantic.text.primary
	vars["--primary"] = t.semantic.accent.default
	vars["--primary-foreground"] = t.semantic.text.onAccent
	vars["--secondary"] = t.semantic.bg.secondary
	vars["--secondary-foreground"] = t.semantic.text.primary
	vars["--muted"] = t.semantic.bg.tertiary
	vars["--muted-foreground"] = t.semantic.text.muted
	vars["--destructive"] = t.status.error
	vars["--destructive-foreground"] = t.status.errorOnSolid
	vars["--input"] = t.component.inputBorder
	vars["--ring"] = t.semantic.border.focus

	vars["--chart-1"] = t.semantic.accent.default
	vars["--chart-2"] = t.semantic.syntax.string
	vars["--chart-3"] = t.semantic.syntax.function
	vars["--chart-4"] = t.status.warning
	vars["--chart-5"] = t.status.error

	vars["--sidebar"] = t.component.sidebarBg
	vars["--sidebar-foreground"] = t.semantic.text.primary
	vars["--sidebar-primary"] = t.semantic.accent.default
	vars["--sidebar-primary-foreground"] = t.semantic.text.onAccent
	vars["--sidebar-accent"] = t.semantic.accent.subtle
	vars["--sidebar-accent-foreground"] = t.semantic.accent.text
	vars["--sidebar-ring"] = t.semantic.border.focus

	vars["--tag-bg"] = t.tag.bg
	vars["--tag-active-bg"] = t.tag.activeBg
	vars["--tag-text"] = t.tag.text
	vars["--tag-active-text"] = t.tag.activeText
	vars["--tag-font-size"] = t.tag.fontSize
	vars["--tag-font-weight"] = t.tag.fontWeight
	vars["--tag-border-radius"] = t.tag.borderRadius
	vars["--tag-padding"] = t.tag.padding

	vars["--heading-font-weight"] = t.heading.fontWeight
	vars["--normal-weight"] = t.typography.editor.fontWeight
	vars["--inline-title-margin-bottom"] = t.heading.inlineTitleMarginBottom ?? "1rem"
	vars["--h1-font-size"] = t.heading.h1FontSize
	vars["--h2-font-size"] = t.heading.h2FontSize
	vars["--h3-font-size"] = t.heading.h3FontSize
	vars["--h4-font-size"] = t.heading.h4FontSize
	vars["--h5-font-size"] = t.heading.h5FontSize
	vars["--h6-font-size"] = t.heading.h6FontSize
	vars["--h1-color"] = t.heading.h1Color ?? t.semantic.syntax.heading
	vars["--h2-color"] = t.heading.h2Color ?? t.semantic.syntax.heading
	vars["--h3-color"] = t.heading.h3Color ?? t.semantic.syntax.heading
	vars["--h4-color"] = t.heading.h4Color ?? t.semantic.syntax.heading
	vars["--h5-color"] = t.heading.h5Color ?? t.semantic.syntax.heading
	vars["--h6-color"] = t.heading.h6Color ?? t.semantic.syntax.heading

	vars["--radius"] = t.sizing.radius
	vars["--ui-font-size"] = t.sizing.uiFontSize
	vars["--editor-font-size"] = t.sizing.editorFontSize
	vars["--editor-paragraph-spacing"] = t.sizing.editorParagraphSpacing
	vars["--markdown-content-width"] = t.markdown?.contentWidth ?? "720px"
	vars["--markdown-content-gutter"] = t.markdown?.contentGutter ?? "40px"
	vars["--markdown-block-radius"] = t.markdown?.blockRadius ?? "6px"
	vars["--markdown-block-spacing"] = t.markdown?.blockSpacing ?? "1em"
	vars["--markdown-code-font-family"] = t.markdown?.codeFontFamily ?? defaultMarkdownCodeFontFamily
	vars["--markdown-code-font-size"] = t.markdown?.codeFontSize ?? defaultMarkdownCodeFontSize
	vars["--markdown-code-padding-inline"] = t.markdown?.codePaddingInline ?? "16px"
	vars["--markdown-code-padding-block"] = t.markdown?.codePaddingBlock ?? "8px"
	vars["--markdown-callout-padding-block"] = t.markdown?.calloutPaddingBlock ?? "12px"
	vars["--markdown-callout-padding-inline-start"] = t.markdown?.calloutPaddingInlineStart ?? "24px"
	vars["--markdown-callout-padding-inline-end"] = t.markdown?.calloutPaddingInlineEnd ?? "12px"

	return vars
}

export function generateCSSString(theme: Theme): string {
	const vars = generateCSSVariables(theme)
	const selector = `.theme-${theme.name}`

	const lines = [`${selector} {`]
	Object.entries(vars).forEach(([key, value]) => {
		lines.push(`  ${key}: ${value};`)
	})
	lines.push(`  color-scheme: ${theme.tokens.colorScheme};`)
	lines.push("}")

	return lines.join("\n")
}
