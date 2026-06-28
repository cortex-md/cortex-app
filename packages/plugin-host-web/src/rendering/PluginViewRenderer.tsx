import {
	getSharedRenderer,
	type SanitizedMarkdownHtml,
	sanitizeRenderedMarkdownHtml,
} from "@cortex/renderer"
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Checkbox,
	cn,
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
	Label,
	LucideIcon,
	NativeSelect,
	NativeSelectOption,
	Progress,
	ScrollArea,
	Separator,
	Slider,
	Spinner,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
} from "@cortex/ui"
import type {
	ViewAlertTone,
	ViewButtonVariant,
	ViewDescriptor,
	ViewDispatch,
	ViewGap,
	ViewInputType,
	ViewNode,
	ViewRegistration,
	ViewScrollSize,
	ViewSize,
	ViewState,
	ViewTableAlign,
	ViewTableCellValue,
	ViewTone,
} from "@cortex.md/api"
import { type ChangeEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react"

interface Props {
	registration: ViewRegistration
	state?: Record<string, unknown>
	onStateChange?: (state: Record<string, unknown>) => void
}

const registrationRenderKeys = new WeakMap<ViewRegistration, string>()
let nextRegistrationRenderKey = 0

const gapClasses: Record<ViewGap, string> = {
	none: "gap-0",
	xs: "gap-1",
	sm: "gap-2",
	md: "gap-3",
	lg: "gap-4",
}

const textToneClasses: Record<ViewTone, string> = {
	default: "text-foreground",
	muted: "text-muted-foreground",
	accent: "text-brand",
	success: "text-status-success-foreground",
	warning: "text-status-warning-foreground",
	danger: "text-status-error-foreground",
}

const textSizeClasses: Record<ViewSize, string> = {
	sm: "text-xs leading-4",
	md: "text-sm leading-5",
	lg: "text-base leading-6",
}

const buttonVariantMap: Record<
	ViewButtonVariant,
	"default" | "secondary" | "outline" | "ghost" | "destructive"
> = {
	primary: "default",
	secondary: "secondary",
	outline: "outline",
	ghost: "ghost",
	danger: "destructive",
}

const buttonSizeMap: Record<ViewSize, "xs" | "default" | "sm"> = {
	sm: "xs",
	md: "default",
	lg: "sm",
}

const scrollSizeClasses: Record<ViewScrollSize, string> = {
	sm: "h-32",
	md: "h-56",
	lg: "h-80",
	fill: "min-h-0 flex-1",
}

const alertToneClasses: Record<ViewAlertTone, string> = {
	default: "",
	success:
		"border-status-success-border bg-status-success-background text-status-success-foreground",
	warning:
		"border-status-warning-border bg-status-warning-background text-status-warning-foreground",
	danger: "border-status-error-border bg-status-error-background text-status-error-foreground",
}

const tableAlignClasses: Record<ViewTableAlign, string> = {
	start: "text-left",
	center: "text-center",
	end: "text-right",
}

function getRegistrationRenderKey(registration: ViewRegistration): string {
	const existingKey = registrationRenderKeys.get(registration)
	if (existingKey) return existingKey

	const nextKey = `${registration.id}:${nextRegistrationRenderKey}`
	nextRegistrationRenderKey += 1
	registrationRenderKeys.set(registration, nextKey)
	return nextKey
}

export function PluginViewRenderer({ registration, state, onStateChange }: Props) {
	return (
		<PluginViewRendererState
			key={getRegistrationRenderKey(registration)}
			registration={registration}
			state={state}
			onStateChange={onStateChange}
		/>
	)
}

function PluginViewRendererState({ registration, state, onStateChange }: Props) {
	const [internalState, setInternalState] = useState<Record<string, unknown>>(
		() => registration.initialState ?? {},
	)

	const currentState = state ?? internalState

	const viewDispatch: ViewDispatch = useCallback(
		(action: string, payload?: unknown) => {
			const nextState = registration.reduce
				? registration.reduce(currentState, action, payload)
				: currentState

			if (state !== undefined) {
				onStateChange?.(nextState)
			} else {
				setInternalState(nextState)
			}
		},
		[currentState, onStateChange, registration, state],
	)

	const viewState: ViewState = { state: currentState }
	const descriptor = registration.render(viewState, viewDispatch)

	return <ViewDescriptorRenderer descriptor={descriptor} dispatch={viewDispatch} />
}

function ViewDescriptorRenderer({
	descriptor,
	dispatch,
}: {
	descriptor: ViewDescriptor
	dispatch: ViewDispatch
}) {
	if (Array.isArray(descriptor)) {
		return (
			<>
				{descriptor.map((node, position) => (
					<ViewNodeRenderer
						key={getViewNodeRenderKey(node, position)}
						node={node}
						dispatch={dispatch}
					/>
				))}
			</>
		)
	}
	return <ViewNodeRenderer node={descriptor} dispatch={dispatch} />
}

function getViewNodeRenderKey(node: ViewNode, position: number): string {
	return `${node.type}:${node.key ?? position}`
}

function shouldRenderStackAsItemGroup(node: Extract<ViewNode, { type: "stack" }>) {
	return (
		Array.isArray(node.children) &&
		node.children.length > 0 &&
		node.children.every((child) => child.type === "item")
	)
}

function ViewChildren({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { children?: ViewDescriptor }>
	dispatch: ViewDispatch
}) {
	if (!node.children) return null
	return <ViewDescriptorRenderer descriptor={node.children} dispatch={dispatch} />
}

function dispatchNodeAction(dispatch: ViewDispatch, action: string | undefined, payload?: unknown) {
	if (action) dispatch(action, payload)
}

function FieldShell({ label, children }: { label?: string; children: ReactNode }) {
	if (!label) return children
	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>
			{children}
		</div>
	)
}

function getInputValue(event: ChangeEvent<HTMLInputElement>, inputType: ViewInputType) {
	if (inputType === "number") {
		return event.currentTarget.value === "" ? "" : event.currentTarget.valueAsNumber
	}
	return event.currentTarget.value
}

function getInputStringValue(value: string | number | undefined): string | number | undefined {
	return value ?? ""
}

function PluginMarkdownNode({ content }: { content: string }) {
	const [html, setHtml] = useState<SanitizedMarkdownHtml | "">("")
	const renderRequestRef = useRef(0)

	useEffect(() => {
		let active = true
		const request = ++renderRequestRef.current
		void getSharedRenderer()
			.render(content)
			.then((renderedHtml) => {
				if (active && request === renderRequestRef.current) setHtml(renderedHtml)
			})
		return () => {
			active = false
		}
	}, [content])

	return (
		<div
			className="markdown-surface text-sm"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: plugin Markdown passes through the renderer sanitizer
			dangerouslySetInnerHTML={{ __html: sanitizeRenderedMarkdownHtml(html) }}
		/>
	)
}

function PluginInputNode({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { type: "input" }>
	dispatch: ViewDispatch
}) {
	const inputType = node.inputType ?? "text"
	const input =
		inputType === "search" ? (
			<InputGroup variant="search">
				<InputGroupAddon>
					<LucideIcon name="search" size={14} />
				</InputGroupAddon>
				<InputGroupInput
					type="search"
					value={getInputStringValue(node.value)}
					placeholder={node.placeholder}
					disabled={node.disabled}
					aria-label={node.label ?? node.placeholder ?? "Plugin search"}
					onChange={(event) =>
						dispatchNodeAction(dispatch, node.action, getInputValue(event, inputType))
					}
				/>
			</InputGroup>
		) : (
			<Input
				type={inputType}
				value={getInputStringValue(node.value)}
				placeholder={node.placeholder}
				disabled={node.disabled}
				min={node.min}
				max={node.max}
				step={node.step}
				aria-label={node.label ?? node.placeholder ?? "Plugin input"}
				onChange={(event) =>
					dispatchNodeAction(dispatch, node.action, getInputValue(event, inputType))
				}
			/>
		)

	return <FieldShell label={node.label}>{input}</FieldShell>
}

function PluginProgressNode({ node }: { node: Extract<ViewNode, { type: "progress" }> }) {
	if (node.value === undefined) {
		return (
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Spinner className="size-3.5" />
				{node.label && <span>{node.label}</span>}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-1">
			{node.label && <span className="text-xs text-muted-foreground">{node.label}</span>}
			<Progress value={Math.max(0, Math.min(100, node.value))} />
		</div>
	)
}

function PluginSettingRowNode({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { type: "setting-row" }>
	dispatch: ViewDispatch
}) {
	return (
		<Field orientation="horizontal" data-disabled={node.disabled || undefined}>
			<FieldContent>
				<FieldLabel>{node.label}</FieldLabel>
				{node.description && <FieldDescription>{node.description}</FieldDescription>}
			</FieldContent>
			{node.children && (
				<div className="flex shrink-0 items-center justify-end">
					<ViewChildren node={node} dispatch={dispatch} />
				</div>
			)}
		</Field>
	)
}

function PluginItemNode({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { type: "item" }>
	dispatch: ViewDispatch
}) {
	const body = (
		<>
			{node.icon && (
				<ItemMedia variant="icon">
					<LucideIcon name={node.icon} size={14} />
				</ItemMedia>
			)}
			<ItemContent>
				<ItemTitle>{node.title}</ItemTitle>
				{node.description && <ItemDescription>{node.description}</ItemDescription>}
				<ViewChildren node={node} dispatch={dispatch} />
			</ItemContent>
			{node.badge && (
				<ItemActions>
					<Badge variant="secondary">{node.badge}</Badge>
				</ItemActions>
			)}
		</>
	)

	if (!node.action) return <Item>{body}</Item>

	return (
		<Item asChild>
			<button
				type="button"
				className="w-full text-left disabled:opacity-50"
				disabled={node.disabled}
				onClick={() => dispatchNodeAction(dispatch, node.action, node.payload)}
			>
				{body}
			</button>
		</Item>
	)
}

function PluginAlertNode({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { type: "alert" }>
	dispatch: ViewDispatch
}) {
	return (
		<Alert
			variant={node.tone === "danger" ? "destructive" : "default"}
			className={alertToneClasses[node.tone ?? "default"]}
		>
			{node.icon && <LucideIcon name={node.icon} size={14} />}
			{node.title && <AlertTitle>{node.title}</AlertTitle>}
			{(node.message || node.children) && (
				<AlertDescription>
					{node.message}
					<ViewChildren node={node} dispatch={dispatch} />
				</AlertDescription>
			)}
		</Alert>
	)
}

function PluginTabsNode({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { type: "tabs" }>
	dispatch: ViewDispatch
}) {
	return (
		<Tabs
			value={node.value}
			onValueChange={(value) => dispatchNodeAction(dispatch, node.action, value)}
		>
			<TabsList>
				{node.tabs.map((tab) => (
					<TabsTrigger key={tab.value} value={tab.value} disabled={tab.disabled}>
						{tab.icon && <LucideIcon name={tab.icon} size={14} />}
						{tab.label}
					</TabsTrigger>
				))}
			</TabsList>
			{node.tabs.map((tab) => (
				<TabsContent key={tab.value} value={tab.value}>
					<ViewDescriptorRenderer descriptor={tab.children} dispatch={dispatch} />
				</TabsContent>
			))}
		</Tabs>
	)
}

function PluginTableCellValue({ value }: { value: ViewTableCellValue }) {
	if (value === null) return null
	return <>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</>
}

function PluginTableNode({
	node,
	dispatch,
}: {
	node: Extract<ViewNode, { type: "table" }>
	dispatch: ViewDispatch
}) {
	if (node.rows.length === 0) {
		return (
			<div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
				{node.emptyMessage ?? "No rows"}
			</div>
		)
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					{node.columns.map((column) => (
						<TableHead key={column.key} className={tableAlignClasses[column.align ?? "start"]}>
							{column.label}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{node.rows.map((row, rowIndex) => (
					<TableRow
						key={row.key ?? rowIndex}
						aria-disabled={row.disabled || undefined}
						className={cn(row.action && "cursor-default", row.disabled && "opacity-50")}
						onClick={() => {
							if (!row.disabled) dispatchNodeAction(dispatch, row.action, row.payload)
						}}
					>
						{node.columns.map((column) => (
							<TableCell key={column.key} className={tableAlignClasses[column.align ?? "start"]}>
								<PluginTableCellValue value={row.cells[column.key] ?? null} />
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

function ViewNodeRenderer({ node, dispatch }: { node: ViewNode; dispatch: ViewDispatch }) {
	switch (node.type) {
		case "stack":
			if (shouldRenderStackAsItemGroup(node)) {
				return (
					<ItemGroup className={gapClasses[node.gap ?? "sm"]}>
						<ViewChildren node={node} dispatch={dispatch} />
					</ItemGroup>
				)
			}
			return (
				<div className={cn("flex min-h-0 flex-col", gapClasses[node.gap ?? "sm"])}>
					<ViewChildren node={node} dispatch={dispatch} />
				</div>
			)
		case "row":
			return (
				<div
					className={cn(
						"flex flex-row",
						node.wrap && "flex-wrap",
						gapClasses[node.gap ?? "sm"],
						node.align === "start" && "items-start",
						(node.align === undefined || node.align === "center") && "items-center",
						node.align === "end" && "items-end",
						node.align === "stretch" && "items-stretch",
						node.justify === "center" && "justify-center",
						node.justify === "end" && "justify-end",
						node.justify === "between" && "justify-between",
					)}
				>
					<ViewChildren node={node} dispatch={dispatch} />
				</div>
			)
		case "text":
			return (
				<span
					className={cn(
						textSizeClasses[node.size ?? "md"],
						textToneClasses[node.tone ?? "default"],
						node.weight === "medium" && "font-medium",
						node.weight === "semibold" && "font-semibold",
					)}
				>
					{node.value}
				</span>
			)
		case "heading": {
			const Heading = node.level === 2 ? "h2" : node.level === 4 ? "h4" : "h3"
			return <Heading className="m-0 text-base font-semibold text-foreground">{node.value}</Heading>
		}
		case "button":
			return (
				<Button
					type="button"
					variant={buttonVariantMap[node.variant ?? "secondary"]}
					size={buttonSizeMap[node.size ?? "md"]}
					disabled={node.disabled}
					onClick={() => dispatchNodeAction(dispatch, node.action, node.payload)}
				>
					{node.icon && <LucideIcon name={node.icon} size={14} />}
					{node.label}
				</Button>
			)
		case "icon-button":
			return (
				<Button
					type="button"
					variant={buttonVariantMap[node.variant ?? "ghost"]}
					size={node.size === "lg" ? "icon-sm" : node.size === "sm" ? "icon-xs" : "icon"}
					aria-label={node.label}
					title={node.label}
					disabled={node.disabled}
					onClick={() => dispatchNodeAction(dispatch, node.action, node.payload)}
				>
					<LucideIcon name={node.icon} size={14} />
				</Button>
			)
		case "input":
			return <PluginInputNode node={node} dispatch={dispatch} />
		case "textarea":
			return (
				<FieldShell label={node.label}>
					<Textarea
						value={node.value ?? ""}
						placeholder={node.placeholder}
						disabled={node.disabled}
						aria-label={node.label ?? node.placeholder ?? "Plugin text area"}
						onChange={(event) => dispatchNodeAction(dispatch, node.action, event.target.value)}
					/>
				</FieldShell>
			)
		case "toggle":
			return (
				<div className="flex items-center justify-between gap-3 text-sm">
					<span>{node.label}</span>
					<Switch
						aria-label={node.label}
						checked={node.checked}
						disabled={node.disabled}
						onCheckedChange={(checked) => dispatchNodeAction(dispatch, node.action, checked)}
					/>
				</div>
			)
		case "checkbox":
			return (
				<div className="flex items-center gap-2 text-sm">
					<Checkbox
						aria-label={node.label}
						checked={node.checked}
						disabled={node.disabled}
						onCheckedChange={(checked) =>
							dispatchNodeAction(dispatch, node.action, checked === true)
						}
					/>
					<span>{node.label}</span>
				</div>
			)
		case "select":
			return (
				<FieldShell label={node.label}>
					<NativeSelect
						value={node.value ?? ""}
						disabled={node.disabled}
						aria-label={node.label ?? "Plugin select"}
						onChange={(event) => dispatchNodeAction(dispatch, node.action, event.target.value)}
					>
						{node.options.map((option) => (
							<NativeSelectOption key={option.value} value={option.value}>
								{option.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</FieldShell>
			)
		case "slider":
			return (
				<FieldShell label={node.label}>
					<Slider
						value={[node.value]}
						min={node.min ?? 0}
						max={node.max ?? 100}
						step={node.step ?? 1}
						disabled={node.disabled}
						onValueChange={(value) => dispatchNodeAction(dispatch, node.action, value[0])}
					/>
				</FieldShell>
			)
		case "icon":
			return (
				<LucideIcon
					name={node.name}
					size={node.size === "lg" ? 18 : node.size === "sm" ? 12 : 14}
					aria-label={node.label}
					className={textToneClasses[node.tone ?? "default"]}
				/>
			)
		case "separator":
			return <Separator />
		case "list":
			return (
				<ul className="m-0 flex list-none flex-col gap-1 p-0">
					<ViewChildren node={node} dispatch={dispatch} />
				</ul>
			)
		case "list-item":
			return (
				<li>
					<button
						type="button"
						className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
						disabled={node.disabled}
						onClick={() => dispatchNodeAction(dispatch, node.action, node.payload)}
					>
						<ViewChildren node={node} dispatch={dispatch} />
					</button>
				</li>
			)
		case "scroll-area":
			return (
				<ScrollArea className={cn("min-h-0", scrollSizeClasses[node.size ?? "md"])}>
					<div className="min-h-0 pr-3">
						<ViewChildren node={node} dispatch={dispatch} />
					</div>
				</ScrollArea>
			)
		case "badge":
			return (
				<Badge
					variant={
						node.tone === "danger"
							? "destructive"
							: node.tone === "default" || node.tone === "accent"
								? "default"
								: "secondary"
					}
				>
					{node.value}
				</Badge>
			)
		case "progress":
			return <PluginProgressNode node={node} />
		case "empty":
			return (
				<div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
					{node.icon && <LucideIcon name={node.icon} size={18} />}
					<span>{node.message}</span>
				</div>
			)
		case "markdown":
			return <PluginMarkdownNode content={node.content} />
		case "setting-row":
			return <PluginSettingRowNode node={node} dispatch={dispatch} />
		case "item":
			return <PluginItemNode node={node} dispatch={dispatch} />
		case "alert":
			return <PluginAlertNode node={node} dispatch={dispatch} />
		case "tabs":
			return <PluginTabsNode node={node} dispatch={dispatch} />
		case "table":
			return <PluginTableNode node={node} dispatch={dispatch} />
		default:
			throw new Error(`Unsupported plugin view node: ${(node as ViewNode).type}`)
	}
}
