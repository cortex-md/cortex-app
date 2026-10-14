import {
	CLOUD_SERVER_LABEL,
	createVaultKeyDraft,
	NEW_REMOTE,
	useRemoteVaultStore,
	useUIStore,
	useVaultStore,
	type VaultKeyDraft,
} from "@cortex/core"
import {
	Button,
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
	Spinner,
} from "@cortex/ui"
import { Check } from "lucide-react"
import { useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { RemoteStep } from "../vault/add-vault/AddVaultSteps"
import { useAddVaultRemotes } from "../vault/add-vault/useAddVaultRemotes"
import {
	FlowBody,
	FlowDialogContent,
	FlowError,
	FlowFooter,
	FlowHeader,
	FlowProgressBars,
} from "../vault/FlowDialog"
import { useVaultKeyFlow } from "./vault-key/useVaultKeyFlow"
import { VaultKeyStepView } from "./vault-key/VaultKeyStepView"

interface VaultLinkModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	unlockMode?: boolean
}

type LinkView = "pick" | "key" | "done"

export function VaultLinkModal({ open, onOpenChange, unlockMode }: VaultLinkModalProps) {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const contentKey = unlockMode ? `unlock-${linkedVaultId ?? "none"}` : "link"
	return (
		<ModalHost open={open} onOpenChange={onOpenChange}>
			<VaultLinkModalContent key={contentKey} onOpenChange={onOpenChange} unlockMode={unlockMode} />
		</ModalHost>
	)
}

function VaultLinkModalContent({
	onOpenChange,
	unlockMode,
}: Pick<VaultLinkModalProps, "onOpenChange" | "unlockMode">) {
	const vault = useVaultStore((state) => state.vault)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const createRemoteVault = useRemoteVaultStore((state) => state.createRemoteVault)
	const openSettings = useUIStore((state) => state.openSettings)
	const remotes = useAddVaultRemotes()
	const vaultName = vault?.name ?? "this vault"
	const [view, setView] = useState<LinkView>(unlockMode ? "key" : "pick")
	const [selected, setSelected] = useState<string | null>(linkedVaultId)
	const [newRemoteName, setNewRemoteName] = useState(vaultName)
	const [targetName, setTargetName] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [keyDraft, setKeyDraft] = useState<VaultKeyDraft>(() =>
		createVaultKeyDraft(unlockMode && linkedVaultId ? "checking" : "none"),
	)
	const updateKeyDraft = (next: Partial<VaultKeyDraft>) =>
		setKeyDraft((current) => ({ ...current, ...next }))
	const close = () => onOpenChange(false)

	const flow = useVaultKeyFlow({
		vaultPath: vault?.path ?? null,
		unlockMode,
		initialRemoteVaultId: linkedVaultId,
		draft: keyDraft,
		updateDraft: updateKeyDraft,
		onLinked: () => {
			if (unlockMode) close()
			else setView("done")
		},
	})

	const options = remotes.options.map((option) =>
		option.takenBy?.entry.path === vault?.path ? { ...option, takenBy: null } : option,
	)
	const isNew = selected === NEW_REMOTE
	const selectedName = isNew
		? newRemoteName.trim()
		: (options.find((option) => option.remote.id === selected)?.remote.name ?? "")
	const linked = Boolean(linkedVaultId)
	const nameForKey = targetName || selectedName || vaultName

	const startLink = async () => {
		if (!selected) return
		setBusy(true)
		setError(null)
		try {
			let remoteVaultId = selected
			if (remoteVaultId === NEW_REMOTE) {
				const created = await createRemoteVault(newRemoteName.trim(), null)
				remoteVaultId = created.id
				setSelected(created.id)
			}
			setTargetName(selectedName)
			setView("key")
			await flow.link(remoteVaultId)
		} catch (linkError) {
			setError(linkError instanceof Error ? linkError.message : String(linkError))
		} finally {
			setBusy(false)
		}
	}

	if (view === "key") {
		if (keyDraft.encryptionStep === "none") {
			return (
				<FlowDialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
					<FlowHeader title={`Couldn’t link ${nameForKey}`}>
						<FlowProgressBars total={3} current={1} />
					</FlowHeader>
					<FlowBody>
						<FlowError>{keyDraft.encryptionError ?? error ?? "Something went wrong."}</FlowError>
					</FlowBody>
					<FlowFooter
						start={
							<Button variant="ghost" onClick={() => setView("pick")}>
								Back
							</Button>
						}
					>
						<Button onClick={close}>Close</Button>
					</FlowFooter>
				</FlowDialogContent>
			)
		}
		return (
			<FlowDialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
				<VaultKeyStepView
					draft={keyDraft}
					flow={flow}
					updateDraft={updateKeyDraft}
					targetName={nameForKey}
					progress={unlockMode ? null : <FlowProgressBars total={3} current={1} />}
					onBack={
						unlockMode
							? undefined
							: () => {
									flow.reset()
									setView("pick")
								}
					}
					onClose={close}
					submitLabel={isNew ? "Create & link" : "Unlock & link"}
				/>
			</FlowDialogContent>
		)
	}

	if (view === "done") {
		return (
			<FlowDialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
				<FlowHeader title="Linked" lead="You can change or stop this from Settings → Sync.">
					<FlowProgressBars total={3} current={2} />
				</FlowHeader>
				<FlowBody>
					<Item variant="muted">
						<ItemMedia variant="icon" className="text-status-success-foreground">
							<Check />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>
								{vaultName} syncs with {nameForKey}
							</ItemTitle>
							<ItemDescription>First sync running. You can keep writing.</ItemDescription>
						</ItemContent>
					</Item>
				</FlowBody>
				<FlowFooter>
					<Button onClick={close}>Done</Button>
				</FlowFooter>
			</FlowDialogContent>
		)
	}

	return (
		<FlowDialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
			<FlowHeader
				title={linked ? "Change remote vault" : `Sync “${vaultName}”`}
				lead="Pick the remote vault this one syncs with."
			>
				<FlowProgressBars total={3} current={0} />
			</FlowHeader>
			<FlowBody>
				<RemoteStep
					authenticated={remotes.authenticated}
					loading={remotes.loading}
					locked={remotes.locked}
					selfHosted={remotes.syncConfig.selfHosted}
					serverLabel={remotes.serverLabel}
					options={options}
					selected={selected}
					allowNew
					newRemoteName={newRemoteName}
					newRemoteTarget={remotes.syncConfig.selfHosted ? "your server" : CLOUD_SERVER_LABEL}
					onSelect={setSelected}
					onNewRemoteNameChange={setNewRemoteName}
					onSeePlans={remotes.openBillingPage}
					onSwitchServer={() => openSettings("sync-self-host")}
					onSignIn={() => openSettings("sync-account")}
				/>
				<FlowError>{error}</FlowError>
			</FlowBody>
			<FlowFooter
				start={
					<Button variant="ghost" onClick={close} disabled={busy}>
						Cancel
					</Button>
				}
			>
				<Button
					onClick={() => void startLink()}
					disabled={
						busy ||
						remotes.locked ||
						!selected ||
						(selected === linkedVaultId && !isNew) ||
						(isNew && !newRemoteName.trim())
					}
				>
					{busy ? <Spinner className="size-3.5" /> : null}
					Continue
				</Button>
			</FlowFooter>
		</FlowDialogContent>
	)
}
