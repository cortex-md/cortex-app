import type * as React from "react"
import { cn } from "./lib/utils"

type SidebarNavPlatform = "macos" | "windows" | "linux"

const SIDEBAR_NAV_WIDTH = "16rem"
const SIDEBAR_NAV_WIDTH_MACOS = "15rem"

function getDefaultSidebarNavPlatform(): SidebarNavPlatform {
	if (typeof document === "undefined") return "windows"
	const platform = document.body.dataset.platform
	return platform === "macos" || platform === "windows" || platform === "linux"
		? platform
		: "windows"
}

function SidebarNav({
	platform: platformProp,
	className,
	style,
	...props
}: React.ComponentProps<"nav"> & { platform?: SidebarNavPlatform }) {
	const platform = platformProp ?? getDefaultSidebarNavPlatform()
	return (
		<nav
			data-slot="sidebar"
			data-platform={platform}
			style={
				{
					"--sidebar-width": platform === "macos" ? SIDEBAR_NAV_WIDTH_MACOS : SIDEBAR_NAV_WIDTH,
					...style,
				} as React.CSSProperties
			}
			className={cn(
				"group/sidebar-wrapper flex h-full min-h-0 w-(--sidebar-width) shrink-0 flex-col gap-2 overflow-auto text-sidebar-foreground backdrop-blur-xl data-[platform=linux]:gap-1.5 data-[platform=linux]:bg-sidebar data-[platform=linux]:backdrop-blur-none data-[platform=macos]:gap-1 data-[platform=macos]:bg-sidebar/55 data-[platform=macos]:saturate-150 data-[platform=windows]:gap-1.5 data-[platform=windows]:bg-sidebar data-[platform=windows]:backdrop-blur-none",
				className,
			)}
			{...props}
		/>
	)
}

function SidebarNavGroup({
	label,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { label: React.ReactNode }) {
	return (
		<div
			data-slot="sidebar-group"
			className={cn(
				"relative flex w-full min-w-0 flex-col p-2 group-data-[platform=macos]/sidebar-wrapper:px-2.5 group-data-[platform=macos]/sidebar-wrapper:py-1 group-data-[platform=windows]/sidebar-wrapper:px-3 group-data-[platform=windows]/sidebar-wrapper:py-1.5",
				className,
			)}
			{...props}
		>
			<div
				data-slot="sidebar-group-label"
				className="flex h-7 shrink-0 items-center px-2.5 text-[12px] font-medium text-sidebar-foreground/70 group-data-[platform=macos]/sidebar-wrapper:h-6 group-data-[platform=macos]/sidebar-wrapper:text-sidebar-foreground/55 group-data-[platform=windows]/sidebar-wrapper:text-sidebar-foreground/65"
			>
				{label}
			</div>
			<ul
				data-slot="sidebar-menu"
				className="flex w-full min-w-0 flex-col gap-1 text-sm group-data-[platform=macos]/sidebar-wrapper:gap-0.5"
			>
				{children}
			</ul>
		</div>
	)
}

function SidebarNavItem({
	isActive = false,
	className,
	type = "button",
	...props
}: React.ComponentProps<"button"> & { isActive?: boolean }) {
	return (
		<li data-slot="sidebar-menu-item" className="relative">
			<button
				type={type}
				data-slot="sidebar-menu-button"
				data-active={isActive}
				aria-current={isActive ? "page" : undefined}
				className={cn(
					"relative flex h-[var(--row-height,36px)] w-full cursor-default items-center gap-2.5 overflow-hidden rounded-[var(--row-radius,10px)] px-2.5 py-0 text-left text-[14px] leading-[18px] text-text-primary outline-hidden transition-[background-color,color] duration-[120ms] ease-out before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent hover:bg-[var(--fill-quiet,color-mix(in_srgb,var(--text-primary)_5.5%,transparent))] focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--border-focus)_55%,transparent)] active:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] disabled:pointer-events-none disabled:opacity-45 data-[active=true]:bg-[var(--fill-selected,color-mix(in_srgb,var(--text-primary)_7%,transparent))] data-[active=true]:font-medium data-[active=true]:text-text-primary [&>svg]:text-text-muted data-[active=true]:[&>svg]:text-text-primary group-data-[platform=windows]/sidebar-wrapper:data-[active=true]:pl-2.5 group-data-[platform=windows]/sidebar-wrapper:data-[active=true]:before:bg-brand [&>span:last-child]:truncate [&>svg]:size-[18px] [&>svg]:shrink-0",
					className,
				)}
				{...props}
			/>
		</li>
	)
}

export { SidebarNav, SidebarNavGroup, SidebarNavItem }
