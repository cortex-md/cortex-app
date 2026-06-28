import { cn, Field, FieldContent, FieldDescription, FieldLabel } from "@cortex/ui"
import type { ComponentProps, ReactNode } from "react"

interface SettingsPageProps extends ComponentProps<"section"> {
	children: ReactNode
}

interface SettingsPageHeaderProps extends ComponentProps<"header"> {
	title: string
	description: string
}

interface SettingsSectionProps extends ComponentProps<"section"> {
	title: string
	description?: string
	action?: ReactNode
	children: ReactNode
}

interface SettingsGroupProps extends ComponentProps<"div"> {
	children: ReactNode
}

interface SettingsGroupContentProps extends ComponentProps<"div"> {
	children: ReactNode
}

interface SettingsFieldProps extends ComponentProps<typeof Field> {
	label: ReactNode
	description?: ReactNode
	htmlFor?: string
	controlClassName?: string
	children: ReactNode
}

interface SettingsListProps extends ComponentProps<"div"> {
	children: ReactNode
}

interface SettingsListItemProps extends ComponentProps<"div"> {
	children: ReactNode
}

interface SettingsEmptyStateProps extends ComponentProps<"p"> {
	children: ReactNode
}

export function SettingsPage({ className, children, ...props }: SettingsPageProps) {
	return (
		<section
			data-slot="settings-page"
			className={cn("flex w-full flex-col gap-7", className)}
			{...props}
		>
			{children}
		</section>
	)
}

export function SettingsPageHeader({
	title,
	description,
	className,
	...props
}: SettingsPageHeaderProps) {
	return (
		<header
			data-slot="settings-page-header"
			className={cn("flex flex-col gap-1.5", className)}
			{...props}
		>
			<h1 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-foreground">
				{title}
			</h1>
			<p className="m-0 max-w-2xl text-[13px] leading-5 text-muted-foreground">{description}</p>
		</header>
	)
}

export function SettingsSection({
	title,
	description,
	action,
	children,
	className,
	...props
}: SettingsSectionProps) {
	return (
		<section
			data-slot="settings-section"
			className={cn("flex flex-col gap-2.5", className)}
			{...props}
		>
			<div className="flex min-h-8 items-end justify-between gap-4 px-0.5">
				<div className="min-w-0">
					<h2 className="m-0 text-[15px] leading-5 font-semibold text-foreground">{title}</h2>
					{description && (
						<p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">{description}</p>
					)}
				</div>
				{action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
			</div>
			{children}
		</section>
	)
}

export function SettingsGroup({ className, children, ...props }: SettingsGroupProps) {
	return (
		<div
			data-slot="settings-group"
			className={cn(
				"group/field-group @container/field-group overflow-hidden rounded-[10px] border border-settings-group-border bg-settings-group divide-y divide-settings-group-divider",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	)
}

export function SettingsGroupContent({ className, children, ...props }: SettingsGroupContentProps) {
	return (
		<div data-slot="settings-group-content" className={cn("p-4", className)} {...props}>
			{children}
		</div>
	)
}

export function SettingsField({
	label,
	description,
	htmlFor,
	controlClassName,
	className,
	children,
	...props
}: SettingsFieldProps) {
	return (
		<Field
			orientation="responsive"
			className={cn(
				"min-h-14 justify-between gap-3 px-4 py-3 @md/field-group:items-center",
				className,
			)}
			{...props}
		>
			<FieldContent className="min-w-0 gap-0.5">
				<FieldLabel htmlFor={htmlFor} className="w-auto max-w-full text-[13px] font-medium">
					{label}
				</FieldLabel>
				{description && (
					<FieldDescription className="text-xs leading-[18px]">{description}</FieldDescription>
				)}
			</FieldContent>
			<div
				className={cn(
					"flex w-full min-w-0 justify-start @md/field-group:min-w-[180px] @md/field-group:max-w-[320px] @md/field-group:flex-1 @md/field-group:justify-end",
					controlClassName,
				)}
			>
				{children}
			</div>
		</Field>
	)
}

export function SettingsList({ className, children, ...props }: SettingsListProps) {
	return (
		<div
			data-slot="settings-list"
			className={cn("flex flex-col divide-y divide-settings-group-divider", className)}
			{...props}
		>
			{children}
		</div>
	)
}

export function SettingsListItem({ className, children, ...props }: SettingsListItemProps) {
	return (
		<div className={cn("group flex min-h-14 items-center gap-3 px-4 py-3", className)} {...props}>
			{children}
		</div>
	)
}

export function SettingsEmptyState({ className, children, ...props }: SettingsEmptyStateProps) {
	return (
		<p className={cn("m-0 px-4 py-3 text-[13px] text-muted-foreground", className)} {...props}>
			{children}
		</p>
	)
}
