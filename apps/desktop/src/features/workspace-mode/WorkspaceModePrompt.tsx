import { useAppStore } from "@cortex/core"
import type { WorkspaceMode } from "@cortex/settings"
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cortex/ui"
import { useState } from "react"
import { setWorkspaceMode, useWorkspaceMode } from "./workspaceMode"

interface WorkspaceModeOption {
	mode: WorkspaceMode
	title: string
	description: string
}

const WORKSPACE_MODE_OPTIONS: WorkspaceModeOption[] = [
	{
		mode: "full",
		title: "Full workspace",
		description: "Sidebars, tabs, and note details around your writing.",
	},
	{
		mode: "writing",
		title: "Writing",
		description: "Just the note. Everything else stays one shortcut away.",
	},
]

function WorkspaceModePreview({ mode }: { mode: WorkspaceMode }) {
	return (
		<span className="workspace-mode-preview" data-mode={mode} aria-hidden="true">
			{mode === "full" && <span className="workspace-mode-preview-sidebar" />}
			<span className="workspace-mode-preview-page">
				<span />
				<span />
				<span />
			</span>
			{mode === "full" && <span className="workspace-mode-preview-aside" />}
		</span>
	)
}

export function WorkspaceModePrompt() {
	const currentMode = useWorkspaceMode()
	const [open, setOpen] = useState(true)

	const finish = () => {
		setOpen(false)
		void useAppStore.getState().markWorkspaceModeChosen()
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) finish()
			}}
		>
			<DialogContent
				className="workspace-mode-prompt"
				showCloseButton={false}
				onInteractOutside={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>How do you like to write?</DialogTitle>
					<DialogDescription>
						Pick a starting point. You can switch anytime with ⌘. or in Settings → Appearance.
					</DialogDescription>
				</DialogHeader>
				<div className="workspace-mode-options" role="radiogroup" aria-label="Workspace mode">
					{WORKSPACE_MODE_OPTIONS.map((option) => (
						<Button
							key={option.mode}
							type="button"
							variant="ghost"
							role="radio"
							aria-checked={currentMode === option.mode}
							className="workspace-mode-option"
							onClick={() => setWorkspaceMode(option.mode)}
						>
							<WorkspaceModePreview mode={option.mode} />
							<span className="workspace-mode-option-copy">
								<b>{option.title}</b>
								<small>{option.description}</small>
							</span>
						</Button>
					))}
				</div>
				<DialogFooter>
					<Button type="button" onClick={finish}>
						Continue
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
