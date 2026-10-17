import type { AppUpdateStatus } from "@cortex/platform"
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@cortex/ui"
import {
	ArrowUpCircleIcon,
	ExternalLinkIcon,
	FolderInputIcon,
	RotateCwIcon,
	SparklesIcon,
} from "lucide-react"
import { openSettings } from "../settings/settingsModal"
import {
	canMoveToApplications,
	needsManualInstall,
	openAppUpdateDownloadPage,
} from "./appUpdatePresentation"
import {
	getAppUpdateSnapshot,
	installAppUpdateNow,
	moveAppToApplications,
	setAppUpdateInstallOnQuit,
	useAppUpdateSelector,
	useAppUpdateSnapshot,
} from "./appUpdateStore"
import { openChangelogTab } from "./openChangelog"

const STATUS_BUTTON_CLASS = "statusbar-item statusbar-btn gap-1.5 tracking-normal active:scale-100"

function handleOpenNotes(): void {
	const version = getAppUpdateSnapshot().pendingUpdate?.version
	if (version) void openChangelogTab(version)
}

function handleRestartNow(): void {
	void installAppUpdateNow()
}

function handleDownloadPage(): void {
	openAppUpdateDownloadPage(getAppUpdateSnapshot())
}

function handleMoveToApplications(): void {
	void moveAppToApplications()
}

function handleInstallOnQuit(checked: boolean): void {
	void setAppUpdateInstallOnQuit(checked)
}

function handleOpenSettings(): void {
	openSettings("general", "general.updates")
}

/** Shows only once an update needs a decision; it never opens on its own or takes focus. */
export function AppUpdateIndicator() {
	const visible = useAppUpdateSelector(selectIndicatorVisible)
	return visible ? <AppUpdateMenu /> : null
}

function selectIndicatorVisible(status: AppUpdateStatus): boolean {
	if (!status.pendingUpdate) return false
	return status.state === "ready" || (needsManualInstall(status) && status.state === "available")
}

function AppUpdateMenu() {
	const status = useAppUpdateSnapshot()
	const pendingVersion = status.pendingUpdate?.version
	const manual = needsManualInstall(status)
	const ready = status.state === "ready"

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="xs" className={`${STATUS_BUTTON_CLASS} hover:underline`}>
					<ArrowUpCircleIcon className="w-3.5 h-3.5 text-status-success" />
					<span>{ready && !manual ? "Restart to update" : `Cortex ${pendingVersion}`}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side="top" className="min-w-[220px]">
				<DropdownMenuItem onSelect={handleOpenNotes} className="gap-2 text-xs">
					<SparklesIcon className="w-3.5 h-3.5" />
					What's New in {pendingVersion}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{ready && !manual && (
					<>
						<DropdownMenuItem onSelect={handleRestartNow} className="gap-2 text-xs">
							<RotateCwIcon className="w-3.5 h-3.5" />
							Restart Now
						</DropdownMenuItem>
						<DropdownMenuCheckboxItem
							checked={status.installOnQuit}
							onCheckedChange={handleInstallOnQuit}
							className="text-xs"
						>
							Install When Cortex Quits
						</DropdownMenuCheckboxItem>
					</>
				)}
				{ready && manual && (
					<DropdownMenuItem onSelect={handleRestartNow} className="gap-2 text-xs">
						<FolderInputIcon className="w-3.5 h-3.5" />
						Show Update in Finder
					</DropdownMenuItem>
				)}
				{!ready && manual && (
					<DropdownMenuItem onSelect={handleDownloadPage} className="gap-2 text-xs">
						<ExternalLinkIcon className="w-3.5 h-3.5" />
						Open Download Page
					</DropdownMenuItem>
				)}
				{canMoveToApplications(status) && (
					<DropdownMenuItem onSelect={handleMoveToApplications} className="gap-2 text-xs">
						<FolderInputIcon className="w-3.5 h-3.5" />
						Move to Applications
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={handleOpenSettings} className="text-xs">
					Update Settings…
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
