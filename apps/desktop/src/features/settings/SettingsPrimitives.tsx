import { getSettingsField } from "@cortex/settings"
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
	fieldId?: string
	description?: string
	action?: ReactNode
	footer?: ReactNode
	children: ReactNode
}

interface SettingsGroupProps extends ComponentProps<"div"> {
	children: ReactNode
}

interface SettingsGroupContentProps extends ComponentProps<"div"> {
	children: ReactNode
}

interface SettingsFieldProps extends ComponentProps<typeof Field> {
	fieldId?: string
	label?: ReactNode
	description?: ReactNode
	icon?: ReactNode
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
		<section data-slot="settings-page" className={cn("settings-page", className)} {...props}>
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
			className={cn("settings-page-header", className)}
			{...props}
		>
			<h1 className="settings-page-title">{title}</h1>
			{description && <p className="settings-page-lead">{description}</p>}
		</header>
	)
}

export function SettingsSection({
	title,
	fieldId,
	description,
	action,
	footer,
	children,
	className,
	...props
}: SettingsSectionProps) {
	return (
		<section
			data-slot="settings-section"
			data-settings-field={fieldId}
			className={cn("settings-section", className)}
			{...props}
		>
			<div className="settings-section-header">
				<h2 className="settings-section-title">{title}</h2>
				{action && <div className="settings-section-action">{action}</div>}
			</div>
			{children}
			{(footer ?? description) && (
				<p className="settings-section-footer">{footer ?? description}</p>
			)}
		</section>
	)
}

export function SettingsGroup({ className, children, ...props }: SettingsGroupProps) {
	return (
		<div
			data-slot="settings-group"
			className={cn("settings-group group/field-group @container/field-group", className)}
			{...props}
		>
			{children}
		</div>
	)
}

export function SettingsGroupContent({ className, children, ...props }: SettingsGroupContentProps) {
	return (
		<div
			data-slot="settings-group-content"
			className={cn("settings-group-content", className)}
			{...props}
		>
			{children}
		</div>
	)
}

export function SettingsField({
	fieldId,
	label,
	description,
	icon,
	htmlFor,
	controlClassName,
	className,
	children,
	...props
}: SettingsFieldProps) {
	const catalogEntry = fieldId ? getSettingsField(fieldId) : undefined
	return (
		<Field
			orientation="responsive"
			data-settings-row=""
			data-settings-field={fieldId}
			data-has-icon={icon ? "true" : undefined}
			className={cn("settings-field justify-between @md/field-group:items-center", className)}
			{...props}
		>
			{icon && <SettingsIconTile>{icon}</SettingsIconTile>}
			<FieldContent className="settings-field-copy">
				<FieldLabel htmlFor={htmlFor} className="settings-field-label">
					{label ?? catalogEntry?.label}
				</FieldLabel>
				{(description ?? catalogEntry?.description) && (
					<FieldDescription className="settings-field-description">
						{description ?? catalogEntry?.description}
					</FieldDescription>
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
		<div data-slot="settings-list" className={cn("settings-list", className)} {...props}>
			{children}
		</div>
	)
}

export function SettingsListItem({ className, children, ...props }: SettingsListItemProps) {
	return (
		<div data-settings-row="" className={cn("settings-list-item group", className)} {...props}>
			{children}
		</div>
	)
}

export function SettingsEmptyState({ className, children, ...props }: SettingsEmptyStateProps) {
	return (
		<p className={cn("settings-empty-state", className)} {...props}>
			{children}
		</p>
	)
}

export function SettingsIconTile({ className, children, ...props }: ComponentProps<"span">) {
	return (
		<span className={cn("settings-icon-tile", className)} aria-hidden="true" {...props}>
			{children}
		</span>
	)
}
