export type ThemeName = string
export type BuiltinThemeName = "paper" | "ink"

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface CommunityThemeManifest {
	id: string
	name: string
	displayName: string
	author: string
	authorUrl?: string
	version: string
	minAppVersion?: string
	colorschemes: {
		dark: string
		light: string
	}
}

export interface ThemeFamily {
	name: string
	displayName: string
	darkTheme: string
	lightTheme: string
}

export interface CSSGenerator {
	generateCSSString(theme: Theme): string
	generateCSSVariables(theme: Theme): Record<string, string>
}

export interface ThemeTokens {
	primitive: {
		stone: Record<string, string>
		ink: Record<string, string>
		amber: Record<string, string>
		amberDark: Record<string, string>
		red: Record<string, string>
		green: Record<string, string>
		yellow: Record<string, string>
	}
	semantic: {
		bg: {
			primary: string
			secondary: string
			tertiary: string
			elevated: string
			hover: string
			active: string
			selected: string
			code: string
			tag: string
		}
		selection?: {
			background: string
			searchMatch: string
			searchMatchActive: string
		}
		text: {
			primary: string
			secondary: string
			muted: string
			disabled: string
			placeholder: string
			onAccent: string
		}
		accent: {
			default: string
			hover: string
			active: string
			subtle: string
			border: string
			text: string
		}
		link: {
			default: string
			hover: string
			broken: string
		}
		border: {
			default: string
			subtle: string
			strong: string
			focus: string
		}
		syntax: {
			keyword: string
			string: string
			comment: string
			number: string
			function: string
			type: string
			operator: string
			property: string
			heading: string
			meta: string
		}
	}
	fonts: {
		ui: string
		editor: string
		mono: string
	}
	typography: {
		ui: {
			fontWeight: string
			lineHeight: string
		}
		editor: {
			fontWeight: string
			lineHeight: string
		}
	}
	status: {
		error: string
		errorBg: string
		errorForeground: string
		errorBorder: string
		errorOnSolid: string
		success: string
		successBg: string
		successForeground: string
		successBorder: string
		successOnSolid: string
		warning: string
		warningBg: string
		warningForeground: string
		warningBorder: string
		warningOnSolid: string
	}
	component: {
		btnPrimaryBg: string
		btnPrimaryText: string
		btnPrimaryHover: string
		inputBg: string
		inputBorder: string
		inputFocusRing: string
		menuBg: string
		menuBorder: string
		menuShadow: string
		menuHover: string
		modalBg: string
		modalBorder: string
		modalShadow: string
		tooltipBg: string
		tooltipText: string
		sidebarBg: string
		sidebarBorder: string
		sidebarGuide: string
		settingsGroupBg: string
		settingsGroupBorder: string
		settingsGroupDivider: string
		tabBg: string
		tabActiveBg: string
		tabAccent: string
		statusbarBg: string
		statusbarBorder: string
		scrollbarThumb: string
		scrollbarHover: string
		shadowRaised: string
		shadowFloating: string
		shadowOverlay: string
	}
	tag: {
		bg: string
		activeBg: string
		text: string
		activeText: string
		fontSize: string
		fontWeight: string
		borderRadius: string
		padding: string
	}
	heading: {
		fontWeight: string
		inlineTitleMarginBottom?: string
		h1FontSize: string
		h2FontSize: string
		h3FontSize: string
		h4FontSize: string
		h5FontSize: string
		h6FontSize: string
		h1Color?: string
		h2Color?: string
		h3Color?: string
		h4Color?: string
		h5Color?: string
		h6Color?: string
	}
	markdown?: {
		contentWidth: string
		contentGutter: string
		blockRadius: string
		blockSpacing: string
		codeFontFamily?: string
		codeFontSize?: string
		codePaddingInline: string
		codePaddingBlock: string
		calloutPaddingBlock: string
		calloutPaddingInlineStart: string
		calloutPaddingInlineEnd: string
		callouts: Record<
			string,
			{
				color: string
				backgroundColor: string
			}
		>
	}
	sizing: {
		radius: string
		uiFontSize: string
		editorFontSize: string
		editorLineHeight: string
		editorParagraphSpacing: string
	}
	colorScheme: "light" | "dark"
}

export interface Theme {
	name: ThemeName
	displayName: string
	isDark: boolean
	tokens: ThemeTokens
}
