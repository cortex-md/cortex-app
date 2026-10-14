import { useAccountStore, useAuthStore, useUIStore } from "@cortex/core"
import { Button } from "@cortex/ui"
import { LogIn, LogOut, UserRound } from "lucide-react"
import { useState } from "react"
import { UserAvatar } from "../../sync/UserAvatar"
import { SettingsGroup, SettingsGroupContent, SettingsSection } from "../SettingsPrimitives"

function getAccountName(displayName: string | null | undefined, email: string): string {
	if (displayName?.trim()) return displayName.trim()
	const localPart = email.split("@")[0] ?? ""
	const words = localPart.split(/[._-]+/).filter(Boolean)
	if (words.length === 0) return "Cortex user"
	return words
		.map((word) => `${word.charAt(0).toLocaleUpperCase()}${word.slice(1).toLocaleLowerCase()}`)
		.join(" ")
}

function formatServerLabel(serverUrl: string | null): string {
	if (!serverUrl) return "Cortex Cloud"
	try {
		return new URL(serverUrl).host
	} catch {
		return serverUrl
	}
}

export function AccountSection() {
	const authenticated = useAuthStore((state) => state.authenticated)
	const user = useAuthStore((state) => state.user)
	const logout = useAuthStore((state) => state.logout)
	const serverUrl = useAuthStore((state) => state.serverUrl)
	const openAuth = useUIStore((state) => state.openAuth)
	const avatarUrl = useAccountStore((state) =>
		state.profile && state.profile.userId === user?.userId ? state.profile.avatarUrl : null,
	)
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
			fieldId="general.account"
			title="Account"
			description="Your identity for Cortex Cloud and shared vaults."
		>
			<SettingsGroup>
				{authenticated && user ? (
					<SettingsGroupContent className="flex items-center gap-3.5">
						<UserAvatar
							size="lg"
							name={getAccountName(user.displayName, user.email)}
							avatarUrl={avatarUrl}
							className="account-avatar ring-1 ring-border/60"
						/>
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
							variant="destructive-soft"
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
						<Button onClick={() => openAuth("login", "general")}>
							<LogIn />
							Sign in
						</Button>
					</SettingsGroupContent>
				)}
			</SettingsGroup>
		</SettingsSection>
	)
}
