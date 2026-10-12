import type { Theme } from "@cortex/theme"
import type {
	ViewAlertTone,
	ViewAlign,
	ViewButtonVariant,
	ViewDescriptor,
	ViewGap,
	ViewJustify,
	ViewNode,
	ViewScrollSize,
	ViewSize,
	ViewTableAlign,
	ViewTableCellValue,
	ViewTone,
} from "@cortex.md/api"
import { Checkbox, Host, Picker, Slider, Switch } from "@expo/ui"
import { createContext, type ReactNode, use } from "react"
import {
	ActivityIndicator,
	type ColorValue,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native"

import { useMobileCommunityStyles } from "@/bootstrap/pluginHost"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { PluginIcon } from "@/features/plugins/PluginIcon"
import { useActiveTheme } from "@/hooks/useActiveTheme"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

type ViewDispatch = (action: string, payload?: unknown) => void

interface ToneColors {
	background: ColorValue
	border: ColorValue
	text: ColorValue
}

interface PluginViewPalette {
	tones: Record<ViewTone, ColorValue>
	alerts: Record<ViewAlertTone, ToneColors>
	buttons: Record<ViewButtonVariant, ToneColors>
	surface: ColorValue
	separator: ColorValue
	label: ColorValue
	secondaryLabel: ColorValue
}

interface PluginViewContextValue {
	dispatch: ViewDispatch
	palette: PluginViewPalette
}

const gapSizes: Record<ViewGap, number> = { none: 0, xs: 4, sm: 8, md: 12, lg: 16 }

const alignItems: Record<ViewAlign, ViewStyle["alignItems"]> = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	stretch: "stretch",
}

const justifyContent: Record<ViewJustify, ViewStyle["justifyContent"]> = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	between: "space-between",
}

const textSizes: Record<ViewSize, TextStyle> = {
	sm: { fontSize: 13, lineHeight: 18 },
	md: { fontSize: 15, lineHeight: 20 },
	lg: { fontSize: 17, lineHeight: 22 },
}

const textWeights: Record<"regular" | "medium" | "semibold", TextStyle["fontWeight"]> = {
	regular: "400",
	medium: "500",
	semibold: "600",
}

const headingSizes: Record<2 | 3 | 4, TextStyle> = {
	2: { fontSize: 20, lineHeight: 25 },
	3: { fontSize: 17, lineHeight: 22 },
	4: { fontSize: 15, lineHeight: 20 },
}

const buttonSizes: Record<ViewSize, ViewStyle & { fontSize: number }> = {
	sm: { fontSize: 14, minHeight: 32, paddingHorizontal: 10 },
	md: { fontSize: 15, minHeight: 40, paddingHorizontal: 14 },
	lg: { fontSize: 16, minHeight: 48, paddingHorizontal: 18 },
}

const iconSizes: Record<ViewSize, number> = { sm: 14, md: 17, lg: 21 }

const scrollHeights: Record<Exclude<ViewScrollSize, "fill">, number> = { sm: 128, md: 224, lg: 320 }

const tableAlign: Record<ViewTableAlign, TextStyle["textAlign"]> = {
	start: "left",
	center: "center",
	end: "right",
}

const PluginViewContext = createContext<PluginViewContextValue | null>(null)

function createPalette(colors: MobileColors, { tokens: { semantic, status } }: Theme) {
	const neutral = {
		background: colors.secondaryBackground,
		border: colors.separator,
		text: colors.label,
	}
	return {
		tones: {
			default: colors.label,
			muted: colors.secondaryLabel,
			accent: colors.tint,
			success: status.success,
			warning: status.warning,
			danger: colors.destructive,
		},
		alerts: {
			default: neutral,
			success: {
				background: status.successBg,
				border: status.successBorder,
				text: status.successForeground,
			},
			warning: {
				background: status.warningBg,
				border: status.warningBorder,
				text: status.warningForeground,
			},
			danger: {
				background: status.errorBg,
				border: status.errorBorder,
				text: status.errorForeground,
			},
		},
		buttons: {
			primary: { background: colors.tint, border: colors.tint, text: semantic.text.onAccent },
			secondary: neutral,
			outline: { background: "transparent", border: colors.separator, text: colors.label },
			ghost: { background: "transparent", border: "transparent", text: colors.label },
			danger: { background: status.error, border: status.error, text: status.errorOnSolid },
		},
		surface: colors.secondaryBackground,
		separator: colors.separator,
		label: colors.label,
		secondaryLabel: colors.secondaryLabel,
	} satisfies PluginViewPalette
}

function usePluginViewContext(): PluginViewContextValue {
	const context = use(PluginViewContext)
	if (!context) throw new Error("Plugin view nodes must render inside PluginView")
	return context
}

export function PluginViewCrash({ message }: { message: string }) {
	const { colors } = useMobileColors()
	const { status } = useActiveTheme().tokens
	return (
		<View
			style={[styles.alert, { backgroundColor: status.errorBg, borderColor: status.errorBorder }]}
		>
			<Text style={[styles.alertTitle, { color: status.errorForeground }]}>This view crashed</Text>
			<Text selectable style={[styles.bodyText, { color: colors.secondaryLabel }]}>
				{message}
			</Text>
		</View>
	)
}

export function PluginViewDescriptor({
	descriptor,
	dispatch,
}: {
	descriptor: ViewDescriptor
	dispatch: ViewDispatch
}) {
	const { colors } = useMobileColors()
	const theme = useActiveTheme()
	return (
		<PluginViewContext value={{ dispatch, palette: createPalette(colors, theme) }}>
			<ViewDescriptorRenderer descriptor={descriptor} />
		</PluginViewContext>
	)
}

function getViewNodeRenderKey(node: ViewNode, position: number): string {
	return `${node.type}:${node.key ?? position}`
}

function ViewDescriptorRenderer({ descriptor }: { descriptor: ViewDescriptor }) {
	if (!Array.isArray(descriptor)) return <ViewNodeRenderer node={descriptor} />
	return descriptor.map((node, position) => (
		<ViewNodeRenderer key={getViewNodeRenderKey(node, position)} node={node} />
	))
}

function ViewChildren({ node }: { node: { children?: ViewDescriptor } }) {
	if (!node.children) return null
	return <ViewDescriptorRenderer descriptor={node.children} />
}

function dispatchNodeAction(dispatch: ViewDispatch, action: string | undefined, payload?: unknown) {
	if (action) dispatch(action, payload)
}

function getPressableOpacity(disabled: boolean | undefined, pressed: boolean): number {
	if (disabled) return 0.42
	return pressed ? 0.62 : 1
}

function FieldShell({ label, children }: { label?: string; children: ReactNode }) {
	const { palette } = usePluginViewContext()
	if (!label) return children
	return (
		<View style={styles.field}>
			<Text style={[styles.fieldLabel, { color: palette.secondaryLabel }]}>{label}</Text>
			{children}
		</View>
	)
}

function PluginButton({
	label,
	icon,
	variant,
	size,
	disabled,
	iconOnly,
	onPress,
}: {
	label: string
	icon?: string
	variant: ViewButtonVariant
	size: ViewSize
	disabled?: boolean
	iconOnly?: boolean
	onPress: () => void
}) {
	const { palette } = usePluginViewContext()
	const colors = palette.buttons[variant]
	const { fontSize, ...sizeStyle } = buttonSizes[size]
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				sizeStyle,
				iconOnly && { minWidth: sizeStyle.minHeight, paddingHorizontal: 0 },
				{
					backgroundColor: colors.background,
					borderColor: colors.border,
					opacity: getPressableOpacity(disabled, pressed),
				},
			]}
		>
			{icon ? <PluginIcon color={colors.text as string} name={icon} size={fontSize + 2} /> : null}
			{iconOnly ? null : (
				<Text numberOfLines={1} style={[styles.buttonText, { color: colors.text, fontSize }]}>
					{label}
				</Text>
			)}
		</Pressable>
	)
}

function PluginInputNode({ node }: { node: Extract<ViewNode, { type: "input" }> }) {
	const { dispatch } = usePluginViewContext()
	const inputType = node.inputType ?? "text"
	return (
		<MobileTextField
			accessibilityLabel={node.label ?? node.placeholder ?? "Plugin input"}
			autoCapitalize="none"
			autoCorrect={false}
			editable={!node.disabled}
			keyboardType={inputType === "number" ? "decimal-pad" : "default"}
			label={node.label}
			onChangeText={(text) =>
				dispatchNodeAction(
					dispatch,
					node.action,
					inputType === "number" && text !== "" ? Number(text) : text,
				)
			}
			placeholder={node.placeholder}
			returnKeyType={inputType === "search" ? "search" : "done"}
			secureTextEntry={inputType === "password"}
			value={node.value === undefined ? "" : String(node.value)}
		/>
	)
}

function PluginBadge({ value, tone }: { value: string; tone: ViewTone }) {
	const { palette } = usePluginViewContext()
	const colors =
		tone === "default" || tone === "accent"
			? palette.buttons.primary
			: tone === "muted"
				? palette.alerts.default
				: palette.alerts[tone]
	return (
		<View style={[styles.badge, { backgroundColor: colors.background }]}>
			<Text style={[styles.badgeText, { color: colors.text }]}>{value}</Text>
		</View>
	)
}

function PluginProgressNode({ node }: { node: Extract<ViewNode, { type: "progress" }> }) {
	const { palette } = usePluginViewContext()
	const label = node.label ? (
		<Text style={[styles.captionText, { color: palette.secondaryLabel }]}>{node.label}</Text>
	) : null
	if (node.value === undefined) {
		return (
			<View style={styles.inlineRow}>
				<ActivityIndicator color={palette.tones.accent} size="small" />
				{label}
			</View>
		)
	}
	return (
		<View style={styles.field}>
			{label}
			<View style={[styles.progressTrack, { backgroundColor: palette.surface }]}>
				<View
					style={[
						styles.progressFill,
						{
							backgroundColor: palette.tones.accent,
							width: `${Math.max(0, Math.min(100, node.value))}%`,
						},
					]}
				/>
			</View>
		</View>
	)
}

function PluginMarkdownNode({ content }: { content: string }) {
	const themeTokens = useMobileEditorThemeTokens()
	const pluginStyles = useMobileCommunityStyles()
	return (
		<MarkdownBlock
			content={content}
			pluginStyles={pluginStyles}
			dom={{
				matchContents: true,
				scrollEnabled: false,
				style: styles.transparent,
				useExpoDOMWebView: false,
			}}
			themeTokens={themeTokens}
		/>
	)
}

function PluginItemNode({ node }: { node: Extract<ViewNode, { type: "item" }> }) {
	const { dispatch, palette } = usePluginViewContext()
	const body = (
		<>
			{node.icon ? (
				<PluginIcon color={palette.tones.accent as string} name={node.icon} size={18} />
			) : null}
			<View style={styles.itemContent}>
				<Text style={[styles.itemTitle, { color: palette.label }]}>{node.title}</Text>
				{node.description ? (
					<Text style={[styles.captionText, { color: palette.secondaryLabel }]}>
						{node.description}
					</Text>
				) : null}
				<ViewChildren node={node} />
			</View>
			{node.badge ? <PluginBadge tone="muted" value={node.badge} /> : null}
		</>
	)

	if (!node.action) return <View style={styles.item}>{body}</View>

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled: node.disabled }}
			disabled={node.disabled}
			onPress={() => dispatchNodeAction(dispatch, node.action, node.payload)}
			style={({ pressed }) => [
				styles.item,
				{ opacity: getPressableOpacity(node.disabled, pressed) },
			]}
		>
			{body}
		</Pressable>
	)
}

function PluginAlertNode({ node }: { node: Extract<ViewNode, { type: "alert" }> }) {
	const { palette } = usePluginViewContext()
	const colors = palette.alerts[node.tone ?? "default"]
	return (
		<View
			style={[styles.alert, { backgroundColor: colors.background, borderColor: colors.border }]}
		>
			{node.icon ? <PluginIcon color={colors.text as string} name={node.icon} size={16} /> : null}
			<View style={styles.itemContent}>
				{node.title ? (
					<Text style={[styles.alertTitle, { color: colors.text }]}>{node.title}</Text>
				) : null}
				{node.message ? (
					<Text style={[styles.bodyText, { color: colors.text }]}>{node.message}</Text>
				) : null}
				<ViewChildren node={node} />
			</View>
		</View>
	)
}

function PluginTabsNode({ node }: { node: Extract<ViewNode, { type: "tabs" }> }) {
	const { dispatch, palette } = usePluginViewContext()
	const activeTab = node.tabs.find((tab) => tab.value === node.value)
	return (
		<View style={styles.field}>
			<ScrollView
				contentContainerStyle={styles.tabList}
				horizontal
				showsHorizontalScrollIndicator={false}
			>
				{node.tabs.map((tab) => {
					const colors =
						tab.value === node.value ? palette.buttons.primary : palette.buttons.secondary
					return (
						<Pressable
							accessibilityRole="tab"
							accessibilityState={{ disabled: tab.disabled, selected: tab.value === node.value }}
							disabled={tab.disabled}
							key={tab.value}
							onPress={() => dispatchNodeAction(dispatch, node.action, tab.value)}
							style={({ pressed }) => [
								styles.tab,
								{
									backgroundColor: colors.background,
									opacity: getPressableOpacity(tab.disabled, pressed),
								},
							]}
						>
							{tab.icon ? (
								<PluginIcon color={colors.text as string} name={tab.icon} size={15} />
							) : null}
							<Text style={[styles.buttonText, { color: colors.text }]}>{tab.label}</Text>
						</Pressable>
					)
				})}
			</ScrollView>
			{activeTab ? <ViewDescriptorRenderer descriptor={activeTab.children} /> : null}
		</View>
	)
}

function formatTableCellValue(value: ViewTableCellValue): string {
	if (value === null) return ""
	if (typeof value === "boolean") return value ? "Yes" : "No"
	return String(value)
}

function PluginTableNode({ node }: { node: Extract<ViewNode, { type: "table" }> }) {
	const { dispatch, palette } = usePluginViewContext()
	const frame = { borderColor: palette.separator }

	if (node.rows.length === 0) {
		return (
			<View style={[styles.table, styles.tableEmpty, frame]}>
				<Text style={[styles.bodyText, { color: palette.secondaryLabel }]}>
					{node.emptyMessage ?? "No rows"}
				</Text>
			</View>
		)
	}

	return (
		<View style={[styles.table, frame]}>
			<View style={[styles.tableRow, { backgroundColor: palette.surface }]}>
				{node.columns.map((column) => (
					<Text
						key={column.key}
						style={[
							styles.tableCell,
							styles.tableHeader,
							{ color: palette.secondaryLabel, textAlign: tableAlign[column.align ?? "start"] },
						]}
					>
						{column.label}
					</Text>
				))}
			</View>
			{node.rows.map((row, rowIndex) => (
				<Pressable
					accessibilityState={{ disabled: row.disabled }}
					disabled={row.disabled || !row.action}
					key={row.key ?? rowIndex}
					onPress={() => dispatchNodeAction(dispatch, row.action, row.payload)}
					style={({ pressed }) => [
						styles.tableRow,
						styles.tableBodyRow,
						frame,
						{ opacity: getPressableOpacity(row.disabled, pressed) },
					]}
				>
					{node.columns.map((column) => (
						<Text
							key={column.key}
							style={[
								styles.tableCell,
								{ color: palette.label, textAlign: tableAlign[column.align ?? "start"] },
							]}
						>
							{formatTableCellValue(row.cells[column.key] ?? null)}
						</Text>
					))}
				</Pressable>
			))}
		</View>
	)
}

function ViewNodeRenderer({ node }: { node: ViewNode }) {
	const { dispatch, palette } = usePluginViewContext()

	switch (node.type) {
		case "stack":
			return (
				<View
					style={[
						styles.stack,
						{ gap: gapSizes[node.gap ?? "sm"] },
						node.align && { alignItems: alignItems[node.align] },
					]}
				>
					<ViewChildren node={node} />
				</View>
			)
		case "row":
			return (
				<View
					style={[
						styles.row,
						{
							alignItems: alignItems[node.align ?? "center"],
							flexWrap: node.wrap ? "wrap" : "nowrap",
							gap: gapSizes[node.gap ?? "sm"],
							justifyContent: justifyContent[node.justify ?? "start"],
						},
					]}
				>
					<ViewChildren node={node} />
				</View>
			)
		case "text":
			return (
				<Text
					style={[
						textSizes[node.size ?? "md"],
						{
							color: palette.tones[node.tone ?? "default"],
							fontWeight: textWeights[node.weight ?? "regular"],
						},
					]}
				>
					{node.value}
				</Text>
			)
		case "heading":
			return (
				<Text
					accessibilityRole="header"
					style={[styles.heading, headingSizes[node.level ?? 3], { color: palette.label }]}
				>
					{node.value}
				</Text>
			)
		case "button":
			return (
				<PluginButton
					disabled={node.disabled}
					icon={node.icon}
					label={node.label}
					onPress={() => dispatchNodeAction(dispatch, node.action, node.payload)}
					size={node.size ?? "md"}
					variant={node.variant ?? "secondary"}
				/>
			)
		case "icon-button":
			return (
				<PluginButton
					disabled={node.disabled}
					icon={node.icon}
					iconOnly
					label={node.label}
					onPress={() => dispatchNodeAction(dispatch, node.action, node.payload)}
					size={node.size ?? "md"}
					variant={node.variant ?? "ghost"}
				/>
			)
		case "input":
			return <PluginInputNode node={node} />
		case "textarea":
			return (
				<MobileTextField
					accessibilityLabel={node.label ?? node.placeholder ?? "Plugin text area"}
					editable={!node.disabled}
					label={node.label}
					multiline
					onChangeText={(text) => dispatchNodeAction(dispatch, node.action, text)}
					placeholder={node.placeholder}
					style={styles.textarea}
					value={node.value ?? ""}
				/>
			)
		case "toggle":
			return (
				<View style={styles.controlRow}>
					<Text style={[styles.controlLabel, { color: palette.label }]}>{node.label}</Text>
					<Host matchContents>
						<Switch
							disabled={node.disabled}
							onValueChange={(checked) => dispatchNodeAction(dispatch, node.action, checked)}
							value={node.checked}
						/>
					</Host>
				</View>
			)
		case "checkbox":
			return (
				<Host matchContents style={styles.alignStart}>
					<Checkbox
						disabled={node.disabled}
						label={node.label}
						onValueChange={(checked) => dispatchNodeAction(dispatch, node.action, checked)}
						value={node.checked}
					/>
				</Host>
			)
		case "select":
			return (
				<FieldShell label={node.label}>
					<Host matchContents style={styles.alignStart}>
						<Picker
							enabled={!node.disabled}
							onValueChange={(value) => dispatchNodeAction(dispatch, node.action, String(value))}
							selectedValue={node.value ?? node.options[0]?.value ?? ""}
						>
							{node.options.map((option) => (
								<Picker.Item key={option.value} label={option.label} value={option.value} />
							))}
						</Picker>
					</Host>
				</FieldShell>
			)
		case "slider":
			return (
				<FieldShell label={node.label}>
					<Host matchContents={{ vertical: true }}>
						<Slider
							disabled={node.disabled}
							max={node.max ?? 100}
							min={node.min ?? 0}
							onValueChange={(value) => dispatchNodeAction(dispatch, node.action, value)}
							step={node.step ?? 1}
							value={node.value}
						/>
					</Host>
				</FieldShell>
			)
		case "icon":
			return (
				<View accessibilityLabel={node.label} accessible={Boolean(node.label)}>
					<PluginIcon
						color={palette.tones[node.tone ?? "default"] as string}
						name={node.name}
						size={iconSizes[node.size ?? "md"]}
					/>
				</View>
			)
		case "separator":
			return <View style={[styles.separator, { backgroundColor: palette.separator }]} />
		case "list":
			return (
				<View accessibilityRole="list" style={styles.list}>
					<ViewChildren node={node} />
				</View>
			)
		case "list-item":
			return (
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ disabled: node.disabled }}
					disabled={node.disabled}
					onPress={() => dispatchNodeAction(dispatch, node.action, node.payload)}
					style={({ pressed }) => [
						styles.listItem,
						{ opacity: getPressableOpacity(node.disabled, pressed) },
					]}
				>
					<ViewChildren node={node} />
				</Pressable>
			)
		case "scroll-area":
			if (node.size === "fill") {
				return (
					<View style={styles.stack}>
						<ViewChildren node={node} />
					</View>
				)
			}
			return (
				<ScrollView
					keyboardShouldPersistTaps="handled"
					nestedScrollEnabled
					style={{ maxHeight: scrollHeights[node.size ?? "md"] }}
				>
					<ViewChildren node={node} />
				</ScrollView>
			)
		case "badge":
			return <PluginBadge tone={node.tone ?? "default"} value={node.value} />
		case "progress":
			return <PluginProgressNode node={node} />
		case "empty":
			return (
				<View style={styles.empty}>
					{node.icon ? (
						<PluginIcon color={palette.secondaryLabel as string} name={node.icon} size={22} />
					) : null}
					<Text style={[styles.bodyText, styles.centered, { color: palette.secondaryLabel }]}>
						{node.message}
					</Text>
				</View>
			)
		case "markdown":
			return <PluginMarkdownNode content={node.content} />
		case "setting-row":
			return (
				<View style={[styles.controlRow, node.disabled && styles.disabled]}>
					<View style={styles.itemContent}>
						<Text style={[styles.controlLabel, { color: palette.label }]}>{node.label}</Text>
						{node.description ? (
							<Text style={[styles.captionText, { color: palette.secondaryLabel }]}>
								{node.description}
							</Text>
						) : null}
					</View>
					{node.children ? (
						<View style={styles.inlineRow}>
							<ViewChildren node={node} />
						</View>
					) : null}
				</View>
			)
		case "item":
			return <PluginItemNode node={node} />
		case "alert":
			return <PluginAlertNode node={node} />
		case "tabs":
			return <PluginTabsNode node={node} />
		case "table":
			return <PluginTableNode node={node} />
		default:
			throw new Error(`Unsupported plugin view node: ${(node as ViewNode).type}`)
	}
}

const styles = StyleSheet.create({
	alert: {
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 10,
		padding: 12,
	},
	alertTitle: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	alignStart: {
		alignSelf: "flex-start",
	},
	badge: {
		alignSelf: "flex-start",
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
	},
	bodyText: {
		fontSize: 15,
		lineHeight: 20,
	},
	button: {
		alignItems: "center",
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 6,
		justifyContent: "center",
	},
	buttonText: {
		fontWeight: "600",
	},
	captionText: {
		fontSize: 13,
		lineHeight: 18,
	},
	centered: {
		textAlign: "center",
	},
	controlLabel: {
		flexShrink: 1,
		fontSize: 16,
		lineHeight: 21,
	},
	controlRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		justifyContent: "space-between",
		minHeight: 44,
	},
	disabled: {
		opacity: 0.42,
	},
	empty: {
		alignItems: "center",
		gap: 8,
		justifyContent: "center",
		padding: 24,
	},
	field: {
		gap: 6,
	},
	fieldLabel: {
		fontSize: 12,
		fontWeight: "700",
		lineHeight: 16,
		textTransform: "uppercase",
	},
	heading: {
		fontWeight: "700",
	},
	inlineRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
	item: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 12,
		minHeight: 44,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	itemContent: {
		flex: 1,
		gap: 2,
	},
	itemTitle: {
		fontSize: 16,
		lineHeight: 21,
	},
	list: {
		gap: 4,
	},
	listItem: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		minHeight: 40,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	progressFill: {
		borderRadius: 2,
		height: 4,
	},
	progressTrack: {
		borderRadius: 2,
		height: 4,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
	},
	separator: {
		alignSelf: "stretch",
		height: StyleSheet.hairlineWidth,
	},
	stack: {
		flexDirection: "column",
	},
	tab: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 6,
		minHeight: 34,
		paddingHorizontal: 12,
	},
	tabList: {
		gap: 6,
	},
	table: {
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	tableBodyRow: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	tableCell: {
		flex: 1,
		fontSize: 14,
		lineHeight: 19,
	},
	tableEmpty: {
		padding: 12,
	},
	tableHeader: {
		fontWeight: "600",
	},
	tableRow: {
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	textarea: {
		minHeight: 96,
		textAlignVertical: "top",
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
