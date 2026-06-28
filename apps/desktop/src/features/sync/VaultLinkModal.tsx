import {
	resolveSyncServerUrl,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@cortex/ui"
import { Cloud, CreditCard, Link, Lock, Plus, Unlink, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface VaultLinkModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	unlockMode?: boolean
}

type EncryptionStep = "none" | "enter-password" | "create-password"

interface UnlockPasswordDialogProps {
	password: string
	encryptionError: string | null
	encryptionLoading: boolean
	onPasswordChange: (value: string) => void
	onSubmit: () => void
}

interface CreateEncryptionPasswordDialogProps {
	password: string
	confirmPassword: string
	encryptionError: string | null
	encryptionLoading: boolean
	onPasswordChange: (value: string) => void
	onConfirmPasswordChange: (value: string) => void
	onBack: () => void
	onSubmit: () => void
}

interface LinkedRemoteVaultViewProps {
	linkedVault: RemoteVaultInfo
	onUnlink: () => void
}

interface CreateRemoteVaultViewProps {
	newVaultName: string
	newVaultDescription: string
	onNameChange: (value: string) => void
	onDescriptionChange: (value: string) => void
	onCancel: () => void
	onCreate: () => void
}

interface RemoteVaultPickerViewProps {
	remoteVaults: RemoteVaultInfo[]
	loading: boolean
	encryptionLoading: boolean
	onSelectVault: (remoteVaultId: string) => void
	onCreateClick: () => void
}

interface VaultLinkDraft {
	showCreate: boolean
	newVaultName: string
	newVaultDescription: string
	encryptionStep: EncryptionStep
	password: string
	confirmPassword: string
	encryptionError: string | null
	encryptionLoading: boolean
}

function createVaultLinkDraft(unlockMode: boolean | undefined, linkedVaultId: string | null) {
	return {
		showCreate: false,
		newVaultName: "",
		newVaultDescription: "",
		encryptionStep: unlockMode && linkedVaultId ? "enter-password" : "none",
		password: "",
		confirmPassword: "",
		encryptionError: null,
		encryptionLoading: false,
	} satisfies VaultLinkDraft
}

function UnlockPasswordDialog({
	password,
	encryptionError,
	encryptionLoading,
	onPasswordChange,
	onSubmit,
}: UnlockPasswordDialogProps) {
	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle className="flex items-center gap-2">
					<Lock size={16} />
					Enter Encryption Password
				</DialogTitle>
				<DialogDescription>
					This vault is encrypted. Enter your password to unlock it.
				</DialogDescription>
			</DialogHeader>
			<DialogBody className="dialog-chrome-body flex flex-col gap-3">
				<div>
					<Label htmlFor="unlock-password" className="text-xs">
						Password
					</Label>
					<Input
						id="unlock-password"
						type="password"
						className="mt-1"
						value={password}
						onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
							onPasswordChange(event.target.value)
						}
						onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) =>
							event.key === "Enter" && onSubmit()
						}
						autoFocus
					/>
				</div>
				{encryptionError && (
					<p className="text-xs text-status-error-foreground">{encryptionError}</p>
				)}
			</DialogBody>
			<DialogFooter className="dialog-chrome-footer">
				<DialogClose asChild>
					<Button variant="ghost" size="sm" className="text-xs">
						Cancel
					</Button>
				</DialogClose>
				<Button
					variant="default"
					size="sm"
					className="text-xs"
					onClick={onSubmit}
					disabled={!password || encryptionLoading}
				>
					{encryptionLoading ? "Unlocking..." : "Unlock"}
				</Button>
			</DialogFooter>
		</DialogContent>
	)
}

function CreateEncryptionPasswordDialog({
	password,
	confirmPassword,
	encryptionError,
	encryptionLoading,
	onPasswordChange,
	onConfirmPasswordChange,
	onBack,
	onSubmit,
}: CreateEncryptionPasswordDialogProps) {
	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle className="flex items-center gap-2">
					<Lock size={16} />
					Create Encryption Password
				</DialogTitle>
				<DialogDescription>
					Create a password to encrypt this vault. You will need this password on every device.
				</DialogDescription>
			</DialogHeader>
			<DialogBody className="dialog-chrome-body flex flex-col gap-3">
				<div>
					<Label htmlFor="create-password" className="text-xs">
						Password
					</Label>
					<Input
						id="create-password"
						type="password"
						className="mt-1"
						value={password}
						onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
							onPasswordChange(event.target.value)
						}
						autoFocus
					/>
				</div>
				<div>
					<Label htmlFor="confirm-password" className="text-xs">
						Confirm Password
					</Label>
					<Input
						id="confirm-password"
						type="password"
						className="mt-1"
						value={confirmPassword}
						onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
							onConfirmPasswordChange(event.target.value)
						}
						onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) =>
							event.key === "Enter" && onSubmit()
						}
					/>
				</div>
				{encryptionError && (
					<p className="text-xs text-status-error-foreground">{encryptionError}</p>
				)}
			</DialogBody>
			<DialogFooter className="dialog-chrome-footer">
				<Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
					Back
				</Button>
				<Button
					variant="default"
					size="sm"
					className="text-xs"
					onClick={onSubmit}
					disabled={!password || !confirmPassword || encryptionLoading}
				>
					{encryptionLoading ? "Creating..." : "Create & Link"}
				</Button>
			</DialogFooter>
		</DialogContent>
	)
}

function LinkedRemoteVaultView({ linkedVault, onUnlink }: LinkedRemoteVaultViewProps) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3 rounded-[8px] bg-muted/35 p-3">
				<Cloud size={18} className="shrink-0" />
				<div className="flex flex-col min-w-0 flex-1">
					<span className="text-sm font-medium truncate">{linkedVault.name}</span>
					{linkedVault.description && (
						<span className="text-[10px] text-text-muted truncate">{linkedVault.description}</span>
					)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={onUnlink}
					className="h-6 px-2 text-xs text-status-error-foreground hover:text-status-error"
				>
					<Unlink size={12} />
					Unlink
				</Button>
			</div>
		</div>
	)
}

function CreateRemoteVaultView({
	newVaultName,
	newVaultDescription,
	onNameChange,
	onDescriptionChange,
	onCancel,
	onCreate,
}: CreateRemoteVaultViewProps) {
	return (
		<div className="flex flex-col gap-3">
			<div>
				<Label htmlFor="remote-vault-name" className="text-xs">
					Name
				</Label>
				<Input
					id="remote-vault-name"
					className="mt-1"
					placeholder="My Vault"
					value={newVaultName}
					onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
						onNameChange(event.target.value)
					}
				/>
			</div>
			<div>
				<Label htmlFor="remote-vault-desc" className="text-xs">
					Description (optional)
				</Label>
				<Input
					id="remote-vault-desc"
					className="mt-1"
					placeholder="A brief description"
					value={newVaultDescription}
					onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
						onDescriptionChange(event.target.value)
					}
				/>
			</div>
			<div className="flex items-center justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
				<Button variant="default" size="sm" onClick={onCreate}>
					Create & Link
				</Button>
			</div>
		</div>
	)
}

function RemoteVaultPickerView({
	remoteVaults,
	loading,
	encryptionLoading,
	onSelectVault,
	onCreateClick,
}: RemoteVaultPickerViewProps) {
	return (
		<div className="flex flex-col gap-3">
			{loading || encryptionLoading ? (
				<p className="py-2 text-sm text-muted-foreground">
					{encryptionLoading ? "Checking encryption..." : "Loading remote vaults..."}
				</p>
			) : remoteVaults.length === 0 ? (
				<p className="py-2 text-sm text-muted-foreground">
					No remote vaults found. Create one to start syncing.
				</p>
			) : (
				<div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
					{remoteVaults.map((remoteVault) => (
						<button
							type="button"
							key={remoteVault.id}
							className="flex min-h-10 w-full items-center gap-3 rounded-[8px] p-2 text-left transition-[background-color,color] duration-150 ease-out hover:bg-muted/55"
							onClick={() => onSelectVault(remoteVault.id)}
						>
							<Cloud size={14} className="text-text-muted shrink-0" />
							<div className="flex flex-col min-w-0 flex-1">
								<span className="text-xs font-medium truncate">{remoteVault.name}</span>
								{remoteVault.description && (
									<span className="text-[10px] text-text-muted truncate">
										{remoteVault.description}
									</span>
								)}
							</div>
							{remoteVault.memberCount > 1 && (
								<span className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
									<Users size={10} />
									{remoteVault.memberCount}
								</span>
							)}
							<Link size={12} className="text-text-muted shrink-0" />
						</button>
					))}
				</div>
			)}
			<Button variant="ghost" size="sm" onClick={onCreateClick} className="self-start">
				<Plus size={12} />
				Create new remote vault
			</Button>
		</div>
	)
}

function SubscriptionBlockedView({
	message,
	loading,
	onManagePlan,
}: {
	message: string
	loading: boolean
	onManagePlan: () => void
}) {
	return (
		<Alert variant="destructive">
			<CreditCard />
			<AlertTitle>Plan required</AlertTitle>
			<AlertDescription>
				<div className="flex flex-col gap-3">
					<p>{message}</p>
					<Button size="sm" className="w-fit" onClick={onManagePlan} disabled={loading}>
						{loading ? "Opening plan page" : "Manage plan"}
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	)
}

export function VaultLinkModal({ open, onOpenChange, unlockMode }: VaultLinkModalProps) {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const contentKey = unlockMode ? `unlock-${linkedVaultId ?? "none"}` : "link"
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && (
				<VaultLinkModalContent
					key={contentKey}
					onOpenChange={onOpenChange}
					unlockMode={unlockMode}
				/>
			)}
		</Dialog>
	)
}

function VaultLinkModalContent({
	onOpenChange,
	unlockMode,
}: Pick<VaultLinkModalProps, "onOpenChange" | "unlockMode">) {
	const { vault } = useVaultStore()
	const {
		remoteVaults,
		linkedVaultId,
		loading,
		error,
		fetchRemoteVaults,
		createRemoteVault,
		linkVault,
		unlinkVault,
		loadLink,
		syncConfig,
	} = useRemoteVaultStore()
	const { checkVaultEncryption, createVaultKey, unlockVaultKey } = useSyncStore()
	const subscriptionBlock = useSubscriptionStore((state) => state.block)
	const subscriptionLoading = useSubscriptionStore((state) => state.loading)
	const refreshSubscriptionStatus = useSubscriptionStore((state) => state.refreshStatus)
	const openBillingPage = useSubscriptionStore((state) => state.openBillingPage)

	const [draft, setDraft] = useState<VaultLinkDraft>(() =>
		createVaultLinkDraft(unlockMode, linkedVaultId),
	)
	const pendingVaultIdRef = useRef<string | null>(unlockMode ? linkedVaultId : null)
	const {
		showCreate,
		newVaultName,
		newVaultDescription,
		encryptionStep,
		password,
		confirmPassword,
		encryptionError,
		encryptionLoading,
	} = draft

	const updateDraft = (nextDraft: Partial<VaultLinkDraft>) => {
		setDraft((current) => ({ ...current, ...nextDraft }))
	}

	useEffect(() => {
		if (unlockMode) return
		fetchRemoteVaults()
		if (vault?.path) {
			loadLink(vault.path)
		}
	}, [vault?.path, fetchRemoteVaults, loadLink, unlockMode])

	useEffect(() => {
		if (syncConfig.selfHosted) return
		void refreshSubscriptionStatus(resolveSyncServerUrl(syncConfig)).catch(() => {})
	}, [refreshSubscriptionStatus, syncConfig])

	const resetEncryptionDraft = () => {
		pendingVaultIdRef.current = null
		updateDraft({
			encryptionStep: "none",
			password: "",
			confirmPassword: "",
			encryptionError: null,
		})
	}

	const handleLink = async (remoteVaultId: string) => {
		if (!vault?.path) return
		updateDraft({ encryptionLoading: true, encryptionError: null })
		try {
			const status = await checkVaultEncryption(remoteVaultId)
			pendingVaultIdRef.current = remoteVaultId
			if (status.hasKey) {
				updateDraft({ encryptionStep: "enter-password" })
			} else {
				updateDraft({ encryptionStep: "create-password" })
			}
		} catch (e) {
			updateDraft({ encryptionError: String(e) })
		} finally {
			updateDraft({ encryptionLoading: false })
		}
	}

	const handleUnlockSubmit = async () => {
		const pendingVaultId = pendingVaultIdRef.current
		if (!pendingVaultId || !password || !vault?.path) return
		updateDraft({ encryptionLoading: true, encryptionError: null })
		try {
			await unlockVaultKey(pendingVaultId, password)
			if (!unlockMode) {
				await linkVault(vault.path, pendingVaultId)
			}
			onOpenChange(false)
		} catch (e) {
			const msg = String(e)
			updateDraft({ encryptionError: msg.includes("Wrong password") ? "Wrong password" : msg })
		} finally {
			updateDraft({ encryptionLoading: false })
		}
	}

	const handleCreateSubmit = async () => {
		const pendingVaultId = pendingVaultIdRef.current
		if (!pendingVaultId || !password || !vault?.path) return
		if (password !== confirmPassword) {
			updateDraft({ encryptionError: "Passwords do not match" })
			return
		}
		if (password.length < 8) {
			updateDraft({ encryptionError: "Password must be at least 8 characters" })
			return
		}
		updateDraft({ encryptionLoading: true, encryptionError: null })
		try {
			await createVaultKey(pendingVaultId, password)
			await linkVault(vault.path, pendingVaultId)
			onOpenChange(false)
		} catch (e) {
			updateDraft({ encryptionError: String(e) })
		} finally {
			updateDraft({ encryptionLoading: false })
		}
	}

	const handleUnlink = async () => {
		if (!vault?.path) return
		try {
			await unlinkVault(vault.path)
		} catch {}
	}

	const handleCreate = async () => {
		if (!newVaultName.trim() || !vault?.path) return
		try {
			const created = await createRemoteVault(
				newVaultName.trim(),
				newVaultDescription.trim() || null,
			)
			await handleLink(created.id)
		} catch (e) {
			updateDraft({ encryptionError: String(e) })
		}
	}

	const handleOpenBilling = () => {
		void openBillingPage().catch(() => {})
	}

	const linkedVault = remoteVaults.find((v) => v.id === linkedVaultId)

	if (encryptionStep === "enter-password") {
		return (
			<UnlockPasswordDialog
				password={password}
				encryptionError={encryptionError}
				encryptionLoading={encryptionLoading}
				onPasswordChange={(nextPassword) => updateDraft({ password: nextPassword })}
				onSubmit={handleUnlockSubmit}
			/>
		)
	}

	if (encryptionStep === "create-password") {
		return (
			<CreateEncryptionPasswordDialog
				password={password}
				confirmPassword={confirmPassword}
				encryptionError={encryptionError}
				encryptionLoading={encryptionLoading}
				onPasswordChange={(nextPassword) => updateDraft({ password: nextPassword })}
				onConfirmPasswordChange={(nextConfirmPassword) =>
					updateDraft({ confirmPassword: nextConfirmPassword })
				}
				onBack={resetEncryptionDraft}
				onSubmit={handleCreateSubmit}
			/>
		)
	}

	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[500px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>Link to Remote Vault</DialogTitle>
				<DialogDescription>Link this local vault to a remote vault for syncing.</DialogDescription>
			</DialogHeader>

			<DialogBody className="dialog-chrome-body">
				{linkedVaultId && linkedVault ? (
					<LinkedRemoteVaultView linkedVault={linkedVault} onUnlink={handleUnlink} />
				) : !syncConfig.selfHosted && subscriptionBlock ? (
					<SubscriptionBlockedView
						message={subscriptionBlock.message}
						loading={subscriptionLoading}
						onManagePlan={handleOpenBilling}
					/>
				) : showCreate ? (
					<CreateRemoteVaultView
						newVaultName={newVaultName}
						newVaultDescription={newVaultDescription}
						onNameChange={(nextName) => updateDraft({ newVaultName: nextName })}
						onDescriptionChange={(nextDescription) =>
							updateDraft({ newVaultDescription: nextDescription })
						}
						onCancel={() => updateDraft({ showCreate: false })}
						onCreate={handleCreate}
					/>
				) : (
					<RemoteVaultPickerView
						remoteVaults={remoteVaults}
						loading={loading}
						encryptionLoading={encryptionLoading}
						onSelectVault={handleLink}
						onCreateClick={() => updateDraft({ showCreate: true })}
					/>
				)}

				{(error || encryptionError) && (
					<p className="mt-3 text-xs text-status-error-foreground">{encryptionError || error}</p>
				)}
			</DialogBody>

			<DialogFooter className="dialog-chrome-footer">
				<DialogClose asChild>
					<Button variant="ghost" size="sm" className="text-xs">
						Close
					</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	)
}
