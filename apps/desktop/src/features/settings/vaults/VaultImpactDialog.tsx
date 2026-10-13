import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	cn,
	Input,
	Label,
} from "@cortex/ui"
import { Cloud, Laptop, Users } from "lucide-react"
import { type ReactNode, useId, useState } from "react"

export type ImpactTone = "keep" | "stop" | "gone"

export interface VaultImpact {
	title: string
	description: string
	cells: [ImpactCell, ImpactCell, ImpactCell]
	confirmLabel: string
	destructive?: boolean
	confirmName?: string
}

interface ImpactCell {
	where: string
	what: string
	tone: ImpactTone
}

const CELL_ICONS: [ReactNode, ReactNode, ReactNode] = [
	<Laptop key="mac" />,
	<Cloud key="server" />,
	<Users key="people" />,
]

interface VaultImpactDialogProps {
	impact: VaultImpact | null
	onOpenChange: (open: boolean) => void
	onConfirm: () => void | Promise<void>
}

export function VaultImpactDialog({ impact, onOpenChange, onConfirm }: VaultImpactDialogProps) {
	return (
		<AlertDialog open={impact !== null} onOpenChange={onOpenChange}>
			{impact ? (
				<VaultImpactContent key={impact.title} impact={impact} onConfirm={onConfirm} />
			) : null}
		</AlertDialog>
	)
}

function VaultImpactContent({
	impact,
	onConfirm,
}: {
	impact: VaultImpact
	onConfirm: () => void | Promise<void>
}) {
	const inputId = useId()
	const [typed, setTyped] = useState("")
	const locked = impact.confirmName !== undefined && typed.trim() !== impact.confirmName
	return (
		<AlertDialogContent className="gap-0 rounded-2xl p-6 sm:max-w-[520px]">
			<AlertDialogHeader className="gap-1.5">
				<AlertDialogTitle className="text-[17px] leading-[22px]">{impact.title}</AlertDialogTitle>
				<AlertDialogDescription className="text-[13.5px] leading-5 text-text-secondary">
					{impact.description}
				</AlertDialogDescription>
			</AlertDialogHeader>
			<div className="mt-[18px] grid grid-cols-3 gap-2">
				{impact.cells.map((cell, index) => (
					<div
						key={cell.where}
						className={cn(
							"flex flex-col gap-2 rounded-xl bg-bg-hover p-3.5",
							cell.tone === "gone" && "bg-status-error-background",
						)}
					>
						<span className="flex items-center gap-1.5 text-[12px] leading-none font-medium text-text-secondary [&_svg]:size-[13px]">
							{CELL_ICONS[index]}
							{cell.where}
						</span>
						<b
							className={cn(
								"text-[13px] leading-[18px] font-medium text-text-primary",
								cell.tone === "stop" && "text-status-warning-foreground",
								cell.tone === "gone" && "text-status-error-foreground",
							)}
						>
							{cell.what}
						</b>
					</div>
				))}
			</div>
			{impact.confirmName !== undefined ? (
				<div className="mt-4 grid gap-2">
					<Label htmlFor={inputId} className="text-[12.5px] font-normal text-text-secondary">
						<span>
							Type <b className="text-text-primary">{impact.confirmName}</b> to confirm
						</span>
					</Label>
					<Input
						id={inputId}
						autoComplete="off"
						value={typed}
						onChange={(event) => setTyped(event.target.value)}
					/>
				</div>
			) : null}
			<AlertDialogFooter className="mt-5">
				<AlertDialogCancel variant="ghost" size="sm">
					Cancel
				</AlertDialogCancel>
				<AlertDialogAction
					variant={impact.destructive ? "destructive" : "default"}
					size="sm"
					disabled={locked}
					onClick={(event) => {
						if (locked) {
							event.preventDefault()
							return
						}
						void onConfirm()
					}}
				>
					{impact.confirmLabel}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	)
}
