import {
	formatRelativeTime,
	useAccountStore,
	useAuthStore,
	useRemoteVaultStore,
	useServerCapabilities,
} from "@cortex/core"
import type { AccountDevice } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Button, Input } from "@cortex/ui"
import { LaptopIcon, MailWarningIcon, SmartphoneIcon } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { UserAvatar } from "../../sync/UserAvatar"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "../SettingsPrimitives"
import { EncryptionSection } from "./EncryptionSection"
import { SignedOutNotice } from "./SignedOutNotice"

const AVATAR_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function ProfileSection() {
	const profile = useAccountStore((state) => state.profile)
	const updateProfile = useAccountStore((state) => state.updateProfile)
	const setAvatar = useAccountStore((state) => state.setAvatar)
	const deleteAvatar = useAccountStore((state) => state.deleteAvatar)
	const capabilities = useServerCapabilities()
	const [status, setStatus] = useState<string | null>(null)
	if (!profile) return null

	const pickAvatar = async () => {
		const platform = getPlatform()
		const path = await platform.dialog.pickFile({
			title: "Choose a profile photo",
			filters: [{ name: "Images", extensions: Object.keys(AVATAR_TYPES) }],
		})
		if (!path || !platform.fs.readBinaryFile) return
		const extension = path.split(".").pop()?.toLowerCase() ?? ""
		setStatus(null)
		try {
			await setAvatar(
				await platform.fs.readBinaryFile(path),
				AVATAR_TYPES[extension] ?? "image/png",
			)
		} catch (error) {
			setStatus(messageOf(error))
		}
	}

	return (
		<SettingsSection title="Profile" footer={status ?? undefined}>
			<SettingsGroup>
				{capabilities?.features.avatars !== false && (
					<SettingsField
						icon={
							<UserAvatar
								name={profile.displayName}
								avatarUrl={profile.avatarUrl}
								className="settings-member-avatar"
							/>
						}
						label="Photo"
						description="Shown to people you share vaults with."
					>
						<div className="flex gap-2">
							<Button variant="secondary" size="sm" onClick={() => void pickAvatar()}>
								Change
							</Button>
							{profile.avatarUrl && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => void deleteAvatar().catch(() => {})}
								>
									Remove
								</Button>
							)}
						</div>
					</SettingsField>
				)}
				<SettingsField htmlFor="account-display-name" label="Name">
					<Input
						key={profile.displayName}
						id="account-display-name"
						defaultValue={profile.displayName}
						onBlur={(event) => {
							const displayName = event.target.value.trim()
							if (!displayName || displayName === profile.displayName) return
							setStatus(null)
							void updateProfile({ displayName }).catch((error) => setStatus(messageOf(error)))
						}}
					/>
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}

function EmailSection() {
	const profile = useAccountStore((state) => state.profile)
	const requestEmailChange = useAccountStore((state) => state.requestEmailChange)
	const resendEmailVerification = useAccountStore((state) => state.resendEmailVerification)
	const capabilities = useServerCapabilities()
	const [newEmail, setNewEmail] = useState("")
	const [password, setPassword] = useState("")
	const [status, setStatus] = useState<string | null>(null)
	if (!profile) return null

	const verificationEnabled = capabilities?.features.emailVerification === true
	const submit = async (event: FormEvent) => {
		event.preventDefault()
		setStatus(null)
		try {
			const result = await requestEmailChange(password, newEmail.trim())
			setStatus(
				result.applied
					? "Your email was changed."
					: `Confirm the change from the link sent to ${newEmail.trim()}.`,
			)
			setNewEmail("")
			setPassword("")
		} catch (error) {
			setStatus(messageOf(error))
		}
	}

	return (
		<SettingsSection title="Email" footer={status ?? undefined}>
			<SettingsGroup>
				<SettingsField
					label={profile.email}
					description={
						profile.emailVerified || !verificationEnabled ? "Current email" : "Not verified yet"
					}
					icon={!profile.emailVerified && verificationEnabled ? <MailWarningIcon /> : undefined}
				>
					{!profile.emailVerified && verificationEnabled && (
						<Button
							variant="secondary"
							size="sm"
							onClick={() =>
								void resendEmailVerification()
									.then(() => setStatus("Verification email sent."))
									.catch((error) => setStatus(messageOf(error)))
							}
						>
							Resend verification
						</Button>
					)}
				</SettingsField>
				<form className="settings-field-form" onSubmit={(event) => void submit(event)}>
					<SettingsField htmlFor="account-new-email" label="New email">
						<Input
							id="account-new-email"
							type="email"
							value={newEmail}
							onChange={(event) => setNewEmail(event.target.value)}
						/>
					</SettingsField>
					<SettingsField htmlFor="account-email-password" label="Password">
						<div className="flex w-full gap-2">
							<Input
								id="account-email-password"
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
							<Button type="submit" size="sm" disabled={!newEmail.trim() || !password}>
								Change
							</Button>
						</div>
					</SettingsField>
				</form>
			</SettingsGroup>
		</SettingsSection>
	)
}

function PasswordSection() {
	const changePassword = useAccountStore((state) => state.changePassword)
	const [currentPassword, setCurrentPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [status, setStatus] = useState<string | null>(null)

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		setStatus(null)
		try {
			await changePassword(currentPassword, newPassword)
			setStatus("Password changed. Other devices were signed out.")
			setCurrentPassword("")
			setNewPassword("")
		} catch (error) {
			setStatus(messageOf(error))
		}
	}

	return (
		<SettingsSection title="Password" footer={status ?? undefined}>
			<SettingsGroup>
				<form className="settings-field-form" onSubmit={(event) => void submit(event)}>
					<SettingsField htmlFor="account-current-password" label="Current password">
						<Input
							id="account-current-password"
							type="password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={(event) => setCurrentPassword(event.target.value)}
						/>
					</SettingsField>
					<SettingsField htmlFor="account-new-password" label="New password">
						<div className="flex w-full gap-2">
							<Input
								id="account-new-password"
								type="password"
								autoComplete="new-password"
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
							/>
							<Button type="submit" size="sm" disabled={!currentPassword || newPassword.length < 8}>
								Change
							</Button>
						</div>
					</SettingsField>
				</form>
			</SettingsGroup>
		</SettingsSection>
	)
}

function deviceSyncLabel(device: AccountDevice, vaultId: string | null): string {
	const cursor = device.vaultCursors.find((entry) => entry.vaultId === vaultId)
	if (cursor) return `Synced this vault ${formatRelativeTime(Date.parse(cursor.syncedAt))}`
	if (device.lastSeenAt) return `Active ${formatRelativeTime(Date.parse(device.lastSeenAt))}`
	return "Not synced yet"
}

function AccountDevicesSection() {
	const devices = useAccountStore((state) => state.devices)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const active = devices.filter((device) => !device.revoked)
	if (active.length === 0) return null
	return (
		<SettingsSection title="Signed-in devices">
			<SettingsGroup>
				{active.map((device) => {
					const Icon = /phone|ios|android|mobile/i.test(device.deviceType)
						? SmartphoneIcon
						: LaptopIcon
					return (
						<SettingsField
							key={device.id}
							icon={<Icon />}
							label={device.deviceName}
							description={deviceSyncLabel(device, linkedVaultId)}
						>
							{device.isCurrent && <span className="settings-pill">This device</span>}
						</SettingsField>
					)
				})}
			</SettingsGroup>
		</SettingsSection>
	)
}

export function SyncAccountPage() {
	const authenticated = useAuthStore((state) => state.authenticated)
	const fetchOverview = useAccountStore((state) => state.fetchOverview)
	const ensureCapabilities = useAccountStore((state) => state.ensureCapabilities)
	const error = useAccountStore((state) => state.error)

	// oxlint-disable react-doctor/no-event-handler -- account data follows the signed-in session
	useEffect(() => {
		if (!authenticated) return
		void ensureCapabilities()
		void fetchOverview().catch(() => {})
	}, [authenticated, ensureCapabilities, fetchOverview])
	// oxlint-enable react-doctor/no-event-handler

	if (!authenticated) {
		return (
			<SettingsPage>
				<SignedOutNotice />
			</SettingsPage>
		)
	}
	return (
		<SettingsPage>
			<ProfileSection />
			<EmailSection />
			<PasswordSection />
			<EncryptionSection />
			<AccountDevicesSection />
			{error && <p className="settings-section-error">{error}</p>}
		</SettingsPage>
	)
}
