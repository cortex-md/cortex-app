import { FolderOpen, LockKeyhole } from "lucide-react"
import type { ReactNode } from "react"

interface SpecimenFrameProps {
	children: ReactNode
	className?: string
}

export function SpecimenFrame({ children, className = "" }: SpecimenFrameProps) {
	return (
		<div
			className={`relative rounded-lg border border-dashed border-border-strong bg-bg-elevated/40 px-[clamp(20px,5vw,72px)] py-[clamp(48px,7vw,88px)] ${className}`}
		>
			<span
				className="-top-5 -translate-x-1/2 absolute left-1/2 grid size-10 place-items-center bg-background text-text-primary"
				aria-hidden="true"
			>
				<LockKeyhole className="size-5" />
			</span>
			<span
				className="-bottom-5 -translate-x-1/2 absolute left-1/2 grid size-10 place-items-center bg-background text-text-primary"
				aria-hidden="true"
			>
				<FolderOpen className="size-5" />
			</span>
			{children}
		</div>
	)
}
