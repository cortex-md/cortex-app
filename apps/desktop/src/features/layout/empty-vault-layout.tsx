import {
	BILLING_URL,
	resolveVaultColor,
	useAppStore,
	useAuthStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button } from "@cortex/ui"
import { ArrowRightIcon, FolderOpenIcon, FolderPlusIcon } from "lucide-react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import markUrl64 from "@/assets/cortex-mark-64.webp"
import markUrl128 from "@/assets/cortex-mark-128.webp"
import markUrl192 from "@/assets/cortex-mark-192.webp"
import { openAuth } from "@/utils/modals"
import { openSettings } from "../settings/settingsModal"
import { VaultTile } from "../vault/VaultTile"
import { openAddVault, openRecentVault } from "../vault/vaultActions"

function AccountBadge() {
	const authenticated = useAuthStore((s) => s.authenticated)
	const user = useAuthStore((s) => s.user)

	if (authenticated && user) {
		return (
			<button type="button" className="start-account" onClick={() => openSettings("sync")}>
				<span className="start-account-avatar" aria-hidden="true">
					{user.email.charAt(0).toUpperCase()}
				</span>
				<span className="start-account-email">{user.email}</span>
			</button>
		)
	}

	return (
		<button
			type="button"
			className="start-account start-account--signed-out"
			onClick={() => openAuth("login")}
		>
			Sign in
		</button>
	)
}

function createVaultFromPicker() {
	openAddVault({ start: "create" })
}

function openVaultFromPicker() {
	openAddVault({ start: "open" })
}

function openWhatsNew() {
	void getPlatform().app.openExternalUrl(`${new URL(BILLING_URL).origin}/changelog`)
}

function RecentVaultList() {
	const recentVaults = useVaultStore((s) => s.recentVaults)
	const [activeIndex, setActiveIndex] = useState(0)
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

	useEffect(() => {
		buttonRefs.current[0]?.focus()
	}, [])

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const last = recentVaults.length - 1
		let next: number | null = null
		if (event.key === "ArrowDown") next = activeIndex >= last ? 0 : activeIndex + 1
		if (event.key === "ArrowUp") next = activeIndex <= 0 ? last : activeIndex - 1
		if (event.key === "Home") next = 0
		if (event.key === "End") next = last
		if (next === null) return
		event.preventDefault()
		buttonRefs.current[next]?.focus()
	}

	return (
		<ul className="start-vault-list">
			{recentVaults.map((vault, index) => (
				<li key={vault.path}>
					<button
						ref={(element) => {
							buttonRefs.current[index] = element
						}}
						type="button"
						tabIndex={index === activeIndex ? 0 : -1}
						className={`start-vault ${index === activeIndex ? "is-active" : ""}`}
						onFocus={() => setActiveIndex(index)}
						onMouseEnter={() => setActiveIndex(index)}
						onKeyDown={handleKeyDown}
						onClick={() => void openRecentVault(vault)}
					>
						<VaultTile
							name={vault.name}
							color={resolveVaultColor(vault)}
							className="start-vault-tile"
						/>
						<span className="start-vault-copy">
							<b>{vault.name}</b>
							<small>{vault.displayPath ?? vault.path}</small>
						</span>
						<ArrowRightIcon className="start-vault-go" size={16} aria-hidden="true" />
					</button>
				</li>
			))}
		</ul>
	)
}

export function EmptyVaultLayout() {
	const hasRecentVaults = useVaultStore((s) => s.recentVaults.length > 0)
	const authenticated = useAuthStore((s) => s.authenticated)
	const version = useAppStore((s) => s.version)

	return (
		<div className="start-screen">
			<AccountBadge />
			<div className={`start-column ${hasRecentVaults ? "" : "start-column--first"}`}>
				<img
					className="start-icon"
					src={markUrl128}
					srcSet={`${markUrl64} 64w, ${markUrl128} 128w, ${markUrl192} 192w`}
					sizes="52px"
					alt=""
					width={52}
					height={52}
				/>
				{hasRecentVaults ? (
					<>
						<h1>Pick up where you left off</h1>
						<RecentVaultList />
						<div className="start-actions">
							<Button variant="secondary" onClick={createVaultFromPicker}>
								<FolderPlusIcon />
								New vault
							</Button>
							<Button variant="ghost" onClick={openVaultFromPicker}>
								<FolderOpenIcon />
								Open folder…
							</Button>
						</div>
					</>
				) : (
					<>
						<h1>Your notes, as plain files</h1>
						<p>
							Pick a folder. Cortex writes ordinary Markdown there, readable in any editor — the app
							keeps its own settings in a hidden <code>.cortex</code> folder.
						</p>
						<div className="start-actions">
							<Button size="lg" onClick={createVaultFromPicker}>
								Create a vault
							</Button>
							<Button size="lg" variant="secondary" onClick={openVaultFromPicker}>
								Open a folder
							</Button>
						</div>
						{!authenticated && (
							<small className="start-fine">
								Already on Cortex Sync?{" "}
								<button type="button" onClick={() => openAuth("login")}>
									Sign in
								</button>{" "}
								to download your vaults.
							</small>
						)}
					</>
				)}
			</div>
			<div className="start-version">
				Cortex {version}
				{version && (
					<>
						{" · "}
						<button type="button" onClick={openWhatsNew}>
							What’s new
						</button>
					</>
				)}
			</div>
		</div>
	)
}
