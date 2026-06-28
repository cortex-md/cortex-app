"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeftIcon } from "lucide-react"
import { Slot } from "radix-ui"
import * as React from "react"
import { Button } from "./button"
import { Input } from "./input"
import { cn } from "./lib/utils"
import { Separator } from "./separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet"
import { Skeleton } from "./skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"
import { useIsMobile } from "./use-mobile"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MACOS = "15rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarPlatform = "macos" | "windows" | "linux"

type SidebarContextProps = {
	state: "expanded" | "collapsed"
	open: boolean
	setOpen: (open: boolean) => void
	openMobile: boolean
	setOpenMobile: (open: boolean) => void
	isMobile: boolean
	platform: SidebarPlatform
	toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function getDefaultSidebarPlatform(): SidebarPlatform {
	if (typeof document === "undefined") {
		return "windows"
	}

	const platform = document.body.dataset.platform
	return platform === "macos" || platform === "windows" || platform === "linux"
		? platform
		: "windows"
}

function useSidebar() {
	const context = React.use(SidebarContext)
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.")
	}

	return context
}

function SidebarProvider({
	defaultOpen = true,
	open: openProp,
	onOpenChange: setOpenProp,
	platform: platformProp,
	className,
	style,
	children,
	...props
}: React.ComponentProps<"div"> & {
	defaultOpen?: boolean
	open?: boolean
	onOpenChange?: (open: boolean) => void
	platform?: SidebarPlatform
}) {
	const isMobile = useIsMobile()
	const [openMobile, setOpenMobile] = React.useState(false)
	const platform = platformProp ?? getDefaultSidebarPlatform()

	// This is the internal state of the sidebar.
	// We use openProp and setOpenProp for control from outside the component.
	const [_open, _setOpen] = React.useState(defaultOpen)
	const open = openProp ?? _open
	const setOpen = React.useCallback(
		(value: boolean | ((value: boolean) => boolean)) => {
			const openState = typeof value === "function" ? value(open) : value
			if (setOpenProp) {
				setOpenProp(openState)
			} else {
				_setOpen(openState)
			}

			// This sets the cookie to keep the sidebar state.
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
		},
		[setOpenProp, open],
	)

	// Helper to toggle the sidebar.
	const toggleSidebar = React.useCallback(() => {
		return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
	}, [isMobile, setOpen, setOpenMobile])

	// Adds a keyboard shortcut to toggle the sidebar.
	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				toggleSidebar()
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [toggleSidebar])

	// We add a state so that we can do data-state="expanded" or "collapsed".
	// This makes it easier to style the sidebar with Tailwind classes.
	const state = open ? "expanded" : "collapsed"

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			platform,
			toggleSidebar,
		}),
		[state, open, setOpen, isMobile, openMobile, setOpenMobile, platform, toggleSidebar],
	)

	return (
		<SidebarContext.Provider value={contextValue}>
			<TooltipProvider delayDuration={0}>
				<div
					data-slot="sidebar-wrapper"
					data-platform={platform}
					style={
						{
							"--sidebar-width": platform === "macos" ? SIDEBAR_WIDTH_MACOS : SIDEBAR_WIDTH,
							"--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
							...style,
						} as React.CSSProperties
					}
					className={cn(
						"group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-transparent",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</TooltipProvider>
		</SidebarContext.Provider>
	)
}

function Sidebar({
	side = "left",
	variant = "sidebar",
	collapsible = "offcanvas",
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	side?: "left" | "right"
	variant?: "sidebar" | "floating" | "inset"
	collapsible?: "offcanvas" | "icon" | "none"
}) {
	const { isMobile, state, openMobile, setOpenMobile, platform } = useSidebar()

	if (collapsible === "none") {
		return (
			<div
				data-slot="sidebar"
				data-platform={platform}
				className={cn(
					"flex h-full w-(--sidebar-width) flex-col text-sidebar-foreground backdrop-blur-xl group-data-[platform=macos]/sidebar-wrapper:bg-sidebar/55 group-data-[platform=macos]/sidebar-wrapper:saturate-150 group-data-[platform=windows]/sidebar-wrapper:bg-sidebar group-data-[platform=windows]/sidebar-wrapper:backdrop-blur-none group-data-[platform=linux]/sidebar-wrapper:bg-sidebar group-data-[platform=linux]/sidebar-wrapper:backdrop-blur-none",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		)
	}

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<SheetContent
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					data-platform={platform}
					className="w-(--sidebar-width) bg-sidebar/90 p-0 text-sidebar-foreground backdrop-blur-xl data-[platform=windows]:bg-sidebar data-[platform=windows]:backdrop-blur-none data-[platform=linux]:bg-sidebar data-[platform=linux]:backdrop-blur-none [&>button]:hidden"
					style={
						{
							"--sidebar-width": SIDEBAR_WIDTH_MOBILE,
						} as React.CSSProperties
					}
					side={side}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Sidebar</SheetTitle>
						<SheetDescription>Displays the mobile sidebar.</SheetDescription>
					</SheetHeader>
					<div className="flex h-full w-full flex-col">{children}</div>
				</SheetContent>
			</Sheet>
		)
	}

	return (
		<div
			className="group peer hidden text-sidebar-foreground md:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? collapsible : ""}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar"
			data-platform={platform}
		>
			{/* This is what handles the sidebar gap on desktop */}
			<div
				data-slot="sidebar-gap"
				className={cn(
					"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
					"group-data-[collapsible=offcanvas]:w-0",
					"group-data-[side=right]:rotate-180",
					variant === "floating" || variant === "inset"
						? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
						: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
				)}
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
					side === "left"
						? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
						: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
					// Adjust the padding for floating and inset variants.
					variant === "floating" || variant === "inset"
						? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
						: "border-sidebar-border/70 group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l group-data-[platform=macos]/sidebar-wrapper:border-sidebar-border/25",
					className,
				)}
				{...props}
			>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground backdrop-blur-none group-data-[platform=macos]/sidebar-wrapper:bg-sidebar/55 group-data-[platform=macos]/sidebar-wrapper:backdrop-blur-2xl group-data-[platform=macos]/sidebar-wrapper:saturate-150 group-data-[variant=floating]:rounded-[10px] group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border/70"
				>
					{children}
				</div>
			</div>
		</div>
	)
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
	const { toggleSidebar } = useSidebar()

	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
			className={cn("size-7", className)}
			onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
				onClick?.(event)
				toggleSidebar()
			}}
			{...props}
		>
			<PanelLeftIcon />
			<span className="sr-only">Toggle Sidebar</span>
		</Button>
	)
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
	const { toggleSidebar } = useSidebar()

	return (
		<button
			type="button"
			data-sidebar="rail"
			data-slot="sidebar-rail"
			aria-label="Toggle Sidebar"
			tabIndex={-1}
			onClick={toggleSidebar}
			title="Toggle Sidebar"
			className={cn(
				"absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-[background-color,transform] ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
				"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
				"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
				"group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
				"[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
				"[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
	return (
		<main
			data-slot="sidebar-inset"
			className={cn(
				"relative flex w-full flex-1 flex-col bg-background/80 backdrop-blur-xl group-data-[platform=macos]/sidebar-wrapper:bg-background/70 group-data-[platform=macos]/sidebar-wrapper:backdrop-blur-2xl group-data-[platform=windows]/sidebar-wrapper:bg-background group-data-[platform=windows]/sidebar-wrapper:backdrop-blur-none group-data-[platform=linux]/sidebar-wrapper:bg-background group-data-[platform=linux]/sidebar-wrapper:backdrop-blur-none",
				"md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-[10px] md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
	return (
		<Input
			data-slot="sidebar-input"
			data-sidebar="input"
			size="sm"
			className={cn("h-6 w-full bg-background/80 shadow-none", className)}
			{...props}
		/>
	)
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn(
				"flex flex-col gap-2 p-2 group-data-[platform=macos]/sidebar-wrapper:min-h-12 group-data-[platform=macos]/sidebar-wrapper:px-2.5 group-data-[platform=macos]/sidebar-wrapper:pt-3 group-data-[platform=windows]/sidebar-wrapper:px-3 group-data-[platform=windows]/sidebar-wrapper:pt-3",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn(
				"flex flex-col gap-2 p-2 group-data-[platform=macos]/sidebar-wrapper:px-2.5 group-data-[platform=windows]/sidebar-wrapper:px-3",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="sidebar-separator"
			data-sidebar="separator"
			className={cn("mx-2 w-auto bg-sidebar-border", className)}
			{...props}
		/>
	)
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[platform=macos]/sidebar-wrapper:gap-1 group-data-[platform=windows]/sidebar-wrapper:gap-1.5 group-data-[collapsible=icon]:overflow-hidden",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn(
				"relative flex w-full min-w-0 flex-col p-2 group-data-[platform=macos]/sidebar-wrapper:px-2.5 group-data-[platform=macos]/sidebar-wrapper:py-1 group-data-[platform=windows]/sidebar-wrapper:px-3 group-data-[platform=windows]/sidebar-wrapper:py-1.5",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarGroupLabel({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "div"

	return (
		<Comp
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={cn(
				"flex h-7 shrink-0 items-center rounded-[6px] px-2 text-[11px] font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 group-data-[platform=macos]/sidebar-wrapper:h-6 group-data-[platform=macos]/sidebar-wrapper:text-sidebar-foreground/55 group-data-[platform=windows]/sidebar-wrapper:text-sidebar-foreground/65 [&>svg]:size-4 [&>svg]:shrink-0",
				"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarGroupAction({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "button"

	return (
		<Comp
			data-slot="sidebar-group-action"
			data-sidebar="group-action"
			className={cn(
				"absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-[6px] p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[background-color,color,opacity,transform] hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				// Increases the hit area of the button on mobile.
				"after:absolute after:-inset-2 md:after:hidden",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	)
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn(
				"flex w-full min-w-0 flex-col gap-1 group-data-[platform=macos]/sidebar-wrapper:gap-0.5",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	)
}

const sidebarMenuButtonVariants = cva(
	"peer/menu-button relative flex w-full items-center gap-2 overflow-hidden rounded-[6px] px-2 py-0 text-left text-[13px] ring-sidebar-ring outline-hidden transition-[background-color,color,width,height,padding] before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! group-data-[platform=macos]/sidebar-wrapper:rounded-[6px] group-data-[platform=macos]/sidebar-wrapper:hover:bg-sidebar-accent/50 group-data-[platform=windows]/sidebar-wrapper:rounded-[4px] group-data-[platform=windows]/sidebar-wrapper:data-[active=true]:pl-2.5 group-data-[platform=windows]/sidebar-wrapper:data-[active=true]:before:bg-brand hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent/65 data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent/70 data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
				outline:
					"border border-sidebar-border/70 bg-background/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
			},
			size: {
				default: "h-7 text-[13px]",
				sm: "h-6 text-xs",
				lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

function SidebarMenuButton({
	asChild = false,
	isActive = false,
	variant = "default",
	size = "default",
	tooltip,
	className,
	...props
}: React.ComponentProps<"button"> & {
	asChild?: boolean
	isActive?: boolean
	tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
	const Comp = asChild ? Slot.Root : "button"
	const { isMobile, state } = useSidebar()

	const button = (
		<Comp
			data-slot="sidebar-menu-button"
			data-sidebar="menu-button"
			data-size={size}
			data-active={isActive}
			className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
			{...props}
		/>
	)

	if (!tooltip) {
		return button
	}

	if (typeof tooltip === "string") {
		tooltip = {
			children: tooltip,
		}
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent
				side="right"
				align="center"
				hidden={state !== "collapsed" || isMobile}
				{...tooltip}
			/>
		</Tooltip>
	)
}

function SidebarMenuAction({
	className,
	asChild = false,
	showOnHover = false,
	...props
}: React.ComponentProps<"button"> & {
	asChild?: boolean
	showOnHover?: boolean
}) {
	const Comp = asChild ? Slot.Root : "button"

	return (
		<Comp
			data-slot="sidebar-menu-action"
			data-sidebar="menu-action"
			className={cn(
				"absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-[6px] p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[background-color,color,opacity,transform] peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[platform=macos]/sidebar-wrapper:right-1.5 group-data-[platform=windows]/sidebar-wrapper:rounded-[4px] [&>svg]:size-4 [&>svg]:shrink-0",
				// Increases the hit area of the button on mobile.
				"after:absolute after:-inset-2 md:after:hidden",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				showOnHover &&
					"group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground data-[state=open]:opacity-100 md:opacity-0",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[platform=macos]/sidebar-wrapper:right-2 group-data-[platform=macos]/sidebar-wrapper:h-4 group-data-[platform=macos]/sidebar-wrapper:min-w-4 group-data-[platform=macos]/sidebar-wrapper:text-[11px] group-data-[platform=windows]/sidebar-wrapper:rounded-[4px]",
				"peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarMenuSkeleton({
	className,
	showIcon = false,
	...props
}: React.ComponentProps<"div"> & {
	showIcon?: boolean
}) {
	const [width] = React.useState(() => `${Math.floor(Math.random() * 40) + 50}%`)

	return (
		<div
			data-slot="sidebar-menu-skeleton"
			data-sidebar="menu-skeleton"
			className={cn("flex h-7 items-center gap-2 rounded-[6px] px-2", className)}
			{...props}
		>
			{showIcon && <Skeleton className="size-4 rounded-[6px]" data-sidebar="menu-skeleton-icon" />}
			<Skeleton
				className="h-4 max-w-(--skeleton-width) flex-1"
				data-sidebar="menu-skeleton-text"
				style={
					{
						"--skeleton-width": width,
					} as React.CSSProperties
				}
			/>
		</div>
	)
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[platform=macos]/sidebar-wrapper:mx-3 group-data-[platform=macos]/sidebar-wrapper:gap-0.5 group-data-[platform=macos]/sidebar-wrapper:border-sidebar-border/40",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-sub-item"
			data-sidebar="menu-sub-item"
			className={cn("group/menu-sub-item relative", className)}
			{...props}
		/>
	)
}

function SidebarMenuSubButton({
	asChild = false,
	size = "md",
	isActive = false,
	className,
	...props
}: React.ComponentProps<"a"> & {
	asChild?: boolean
	size?: "sm" | "md"
	isActive?: boolean
}) {
	const Comp = asChild ? Slot.Root : "a"

	return (
		<Comp
			data-slot="sidebar-menu-sub-button"
			data-sidebar="menu-sub-button"
			data-size={size}
			data-active={isActive}
			className={cn(
				"flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-[6px] px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[background-color,color,opacity] hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[platform=macos]/sidebar-wrapper:h-6 group-data-[platform=windows]/sidebar-wrapper:rounded-[4px] [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
				"data-[active=true]:bg-sidebar-accent/65 data-[active=true]:text-sidebar-accent-foreground",
				size === "sm" && "text-xs",
				size === "md" && "text-sm",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	)
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
}
