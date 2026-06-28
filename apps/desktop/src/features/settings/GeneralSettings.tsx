import { useAuthStore, useUIStore, useVaultStore, type VaultRegistryEntry } from "@cortex/core"
import type { GeneralSettings } from "@cortex/settings"
import {
	Avatar,
	AvatarFallback,
	Button,
	isValidLucideIconName,
	LucideIcon,
	Progress,
	Switch,
} from "@cortex/ui"
import { Download, LogIn, LogOut, RefreshCw, Trash2, UserRound, Vault } from "lucide-react"
import { useEffect, useState } from "react"
import {
	checkForAppUpdate,
	installPendingAppUpdate,
	refreshAppUpdateStatus,
	useAppUpdateSnapshot,
} from "../app-updates/appUpdateStore"
import type { UpdateSettingFn } from "."
import {
	SettingsEmptyState,
	SettingsField,
	SettingsGroup,
	SettingsGroupContent,
	SettingsList,
	SettingsListItem,
	SettingsPage,
	SettingsSection,
} from "./SettingsPrimitives"

interface GeneralSectionProps {
	settings: GeneralSettings
	onUpdate: UpdateSettingFn
}

const appUpdateStateLabels = {
	idle: "Not checked yet",
	checking: "Checking for updates",
	"up-to-date": "Cortex is up to date",
	available: "Update available",
	installing: "Installing update",
	installed: "Update installed",
	error: "Update check failed",
	unsupported: "Updates unavailable",
} as const

function formatLastOpened(timestamp: number): string {
	const date = new Date(timestamp * 1000)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

	if (diffDays === 0) return "Today"
	if (diffDays === 1) return "Yesterday"
	if (diffDays < 7) return `${diffDays} days ago`
	return date.toLocaleDateString()
}

function getAccountName(displayName: string | null | undefined, email: string): string {
	if (displayName?.trim()) return displayName.trim()
	const localPart = email.split("@")[0] ?? ""
	const words = localPart.split(/[._-]+/).filter(Boolean)
	if (words.length === 0) return "Cortex user"
	return words
		.map((word) => `${word.charAt(0).toLocaleUpperCase()}${word.slice(1).toLocaleLowerCase()}`)
		.join(" ")
}

function getAccountInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean)
	if (words.length === 0) return "CU"
	return words
		.slice(0, 2)
		.map((word) => word.charAt(0).toLocaleUpperCase())
		.join("")
}

function formatServerLabel(serverUrl: string | null): string {
	if (!serverUrl) return "Cortex Cloud"
	try {
		return new URL(serverUrl).host
	} catch {
		return serverUrl
	}
}

function formatLastChecked(value: string | null): string {
	if (!value) return "Never"
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleString()
}

function formatBytes(value: number): string {
	if (value < 1024) return `${value} B`
	if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
	return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function getInstallLabel(): string {
	return document.body.dataset.platform === "windows" ? "Install" : "Install and restart"
}

function handleCheckForUpdates(): void {
	void checkForAppUpdate("manual")
}

function handleInstallPendingUpdate(): void {
	void installPendingAppUpdate()
}

function AccountSection() {
	const authenticated = useAuthStore((state) => state.authenticated)
	const user = useAuthStore((state) => state.user)
	const logout = useAuthStore((state) => state.logout)
	const serverUrl = useAuthStore((state) => state.serverUrl)
	const openAuth = useUIStore((state) => state.openAuth)
	const [signingOut, setSigningOut] = useState(false)

	const handleSignOut = async () => {
		setSigningOut(true)
		try {
			await logout(false, serverUrl)
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<SettingsSection
			title="Account"
			description="Your identity for Cortex Cloud and shared vaults."
		>
			<SettingsGroup>
				{authenticated && user ? (
					<SettingsGroupContent className="flex items-center gap-3.5">
						<Avatar size="lg" className="ring-1 ring-border/60">
							<AvatarFallback className="bg-brand/10 font-semibold text-brand">
								{getAccountInitials(getAccountName(user.displayName, user.email))}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<p className="m-0 truncate text-[14px] font-semibold text-foreground">
								{getAccountName(user.displayName, user.email)}
							</p>
							<p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
							<p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
								Connected to {formatServerLabel(serverUrl)}
							</p>
						</div>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => void handleSignOut()}
							disabled={signingOut}
						>
							<LogOut />
							{signingOut ? "Signing out" : "Sign out"}
						</Button>
					</SettingsGroupContent>
				) : (
					<SettingsGroupContent className="flex items-center gap-3.5">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/60 text-muted-foreground">
							<UserRound className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="m-0 text-[13px] font-semibold text-foreground">No account connected</p>
							<p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">
								Sign in to enable sync and collaborate in remote vaults.
							</p>
						</div>
						<Button size="sm" onClick={() => openAuth("login", "general")}>
							<LogIn />
							Sign in
						</Button>
					</SettingsGroupContent>
				)}
			</SettingsGroup>
		</SettingsSection>
	)
}

function UpdatesSection() {
	const updateStatus = useAppUpdateSnapshot()
	const pendingUpdate = updateStatus.pendingUpdate
	const checking = updateStatus.state === "checking"
	const installing = updateStatus.state === "installing"
	const progress =
		updateStatus.contentLength && updateStatus.contentLength > 0
			? Math.min(100, Math.round((updateStatus.downloaded / updateStatus.contentLength) * 100))
			: null

	useEffect(() => {
		void refreshAppUpdateStatus()
	}, [])

	return (
		<SettingsSection
			title="Updates"
			description="Signed desktop updates from stable GitHub releases."
		>
			<SettingsGroup>
				<SettingsGroupContent className="flex flex-col gap-3">
					<div className="flex min-w-0 flex-col gap-1">
						<p className="m-0 text-[13px] font-semibold text-foreground">
							{appUpdateStateLabels[updateStatus.state]}
						</p>
						<p className="m-0 text-xs leading-[18px] text-muted-foreground">
							Current version {updateStatus.currentVersion ?? "unknown"} · Last checked{" "}
							{formatLastChecked(updateStatus.lastCheckedAt)}
						</p>
						{pendingUpdate && (
							<p className="m-0 text-xs leading-[18px] text-muted-foreground">
								Version {pendingUpdate.version} is ready for this device.
							</p>
						)}
						{updateStatus.lastError && (
							<p className="m-0 text-xs leading-[18px] text-destructive">
								{updateStatus.lastError}
							</p>
						)}
					</div>

					{installing && (
						<div className="flex flex-col gap-1.5">
							<Progress value={progress ?? 8} />
							<p className="m-0 text-xs text-muted-foreground">
								{progress === null
									? "Downloading update"
									: `${formatBytes(updateStatus.downloaded)} of ${formatBytes(
											updateStatus.contentLength ?? 0,
										)}`}
							</p>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={handleCheckForUpdates}
							disabled={checking || installing}
						>
							<RefreshCw className={checking ? "animate-spin" : ""} />
							Check for updates
						</Button>
						{pendingUpdate && (
							<Button
								size="sm"
								onClick={handleInstallPendingUpdate}
								disabled={checking || installing}
							>
								<Download />
								{getInstallLabel()}
							</Button>
						)}
					</div>
				</SettingsGroupContent>
			</SettingsGroup>
		</SettingsSection>
	)
}

function VaultRow({ entry }: { entry: VaultRegistryEntry }) {
	const { vault, openVault, closeVault, removeRecentVault } = useVaultStore()
	const isActive = vault?.uuid === entry.uuid

	const handleOpen = async () => {
		if (isActive) return
		await closeVault()
		await openVault(entry.path)
	}

	const handleRemove = async () => {
		await removeRecentVault(entry.uuid)
	}

	return (
		<SettingsListItem>
			<span className="flex items-center gap-2 min-w-0 flex-1">
				{entry.color && (
					<span
						className="w-2.5 h-2.5 rounded-full shrink-0"
						style={{ backgroundColor: entry.color }}
					/>
				)}
				{entry.icon && isValidLucideIconName(entry.icon) ? (
					<LucideIcon name={entry.icon} size={16} className="shrink-0 text-text-muted" />
				) : (
					<Vault size={16} className="shrink-0 text-text-muted" />
				)}
				<span className="flex flex-col min-w-0">
					<span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
					<span className="truncate text-xs text-muted-foreground">{entry.path}</span>
				</span>
			</span>
			<span className="text-xs text-muted-foreground whitespace-nowrap">
				{formatLastOpened(entry.lastOpened)}
			</span>
			<span className="flex items-center gap-1">
				{!isActive && (
					<Button variant="ghost" size="sm" onClick={handleOpen} className="h-7 px-2">
						Open
					</Button>
				)}
				{isActive && <span className="px-2 text-xs font-medium text-accent">Active</span>}
				<Button
					variant="ghost"
					size="icon"
					onClick={handleRemove}
					className="h-7 w-7 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
				>
					<Trash2 size={12} />
				</Button>
			</span>
		</SettingsListItem>
	)
}

export function GeneralSection({ settings, onUpdate }: GeneralSectionProps) {
	const { recentVaults } = useVaultStore()

	return (
		<SettingsPage>
			<AccountSection />

			<SettingsSection
				title="Startup"
				description="Choose what Cortex opens when the app launches."
			>
				<SettingsGroup>
					<SettingsField label="Open last vault on startup" htmlFor="auto-open-vault">
						<Switch
							id="auto-open-vault"
							checked={settings.autoOpenLastVault}
							onCheckedChange={(checked) => onUpdate("general", "autoOpenLastVault", checked)}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<UpdatesSection />

			<SettingsSection title="Vaults" description="Recently opened vaults on this device.">
				<SettingsGroup>
					{recentVaults.length === 0 ? (
						<SettingsEmptyState>No recent vaults</SettingsEmptyState>
					) : (
						<SettingsList>
							{recentVaults.map((entry) => (
								<VaultRow key={entry.uuid} entry={entry} />
							))}
						</SettingsList>
					)}
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
