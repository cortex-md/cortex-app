import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import type * as React from "react"
import { Button } from "./button"
import {
	nativeDialogContentMotion,
	nativeDialogSurface,
	nativeOverlayMotion,
} from "./lib/native-styles"
import { cn } from "./lib/utils"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			className={cn("fixed inset-0 z-[90] bg-black/20", nativeOverlayMotion, className)}
			{...props}
		/>
	)
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	showCloseButton?: boolean
}) {
	return (
		<DialogPortal data-slot="dialog-portal">
			<DialogOverlay />
			<div
				data-slot="dialog-positioner"
				className="pointer-events-none fixed inset-0 z-[100] grid place-items-center p-4"
			>
				<DialogPrimitive.Content
					data-slot="dialog-content"
					className={cn(
						"pointer-events-auto relative grid w-full max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-4 rounded-[var(--dialog-radius,14px)] p-6 outline-none sm:max-w-lg",
						nativeDialogSurface,
						nativeOverlayMotion,
						nativeDialogContentMotion,
						className,
					)}
					{...props}
				>
					{children}
					{showCloseButton && (
						<DialogPrimitive.Close
							data-slot="dialog-close"
							className="absolute top-3.5 right-3.5 inline-flex size-8 items-center justify-center rounded-[8px] text-muted-foreground opacity-75 outline-none transition-[background-color,color,opacity,box-shadow] duration-150 ease-out after:absolute after:inset-[-4px] hover:bg-muted/70 hover:text-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none data-[state=open]:bg-muted/70 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
						>
							<XIcon />
							<span className="sr-only">Close</span>
						</DialogPrimitive.Close>
					)}
				</DialogPrimitive.Content>
			</div>
		</DialogPortal>
	)
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-1.5 text-left", className)}
			{...props}
		/>
	)
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="dialog-body" className={cn("min-h-0", className)} {...props} />
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end",
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close asChild>
					<Button variant="outline">Close</Button>
				</DialogPrimitive.Close>
			)}
		</div>
	)
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("text-[15px] leading-5 font-semibold text-foreground", className)}
			{...props}
		/>
	)
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn("text-sm leading-5 text-muted-foreground text-pretty", className)}
			{...props}
		/>
	)
}

export {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
}
