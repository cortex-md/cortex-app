import {
	ADD_VAULT_STEP_LABELS,
	type AddVaultPath,
	type AddVaultStep,
	type AddVaultTarget,
	addVaultStepsFor,
	CLOUD_SERVER_LABEL,
	createAddVaultFlow,
	createVaultKeyDraft,
	formatVaultPath,
	getDefaultVaultLocation,
	NEW_REMOTE,
	resolveAddVaultNames,
	resolveVaultColor,
	type VaultKeyDraft,
} from "@cortex/core"
import { isObsidianVault } from "@cortex/import-export"
import { Button, Spinner } from "@cortex/ui"
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import { obsidianImportModal } from "@/utils/modals"
import { openSettings } from "../../settings/settingsModal"
import { useVaultKeyFlow, type VaultKeyFlow } from "../../sync/vault-key/useVaultKeyFlow"
import { VaultKeyStepView } from "../../sync/vault-key/VaultKeyStepView"
import {
	FlowBody,
	FlowDialogContent,
	FlowError,
	FlowFooter,
	FlowHeader,
	FlowNote,
	type FlowStep,
	FlowStepper,
	FlowSummary,
} from "../FlowDialog"
import { VaultTile } from "../VaultTile"
import { addVaultModal, openRecentVault } from "../vaultActions"
import {
	ChooseStep,
	FolderStep,
	LocationStep,
	NameStep,
	RemoteStep,
	SyncChoiceStep,
} from "./AddVaultSteps"
import { useAddVaultRemotes } from "./useAddVaultRemotes"

export function AddVaultDialogHost() {
	return (
		<ModalStoreHost store={addVaultModal}>
			{(target) => <AddVaultDialogContent key={JSON.stringify(target)} target={target} />}
		</ModalStoreHost>
	)
}

function AddVaultDialogContent({ target }: { target: AddVaultTarget }) {
	const keyFlowRef = useRef<VaultKeyFlow | null>(null)
	const [controller] = useState(() =>
		createAddVaultFlow(target, {
			close: () => addVaultModal.close(),
			isObsidianVault,
			openVault: (entry, options) => openRecentVault(entry, "auto", options),
			linkRemote: async (remoteVaultId, vaultPath) => {
				await keyFlowRef.current?.link(remoteVaultId, vaultPath)
			},
			onOpened: ({ opensHere, adoptObsidian }) => {
				if (opensHere && adoptObsidian) obsidianImportModal.open({ mode: "adopt" })
			},
		}),
	)
	const draft = useSyncExternalStore(controller.store.subscribe, controller.store.getState)
	const [keyDraft, setKeyDraft] = useState<VaultKeyDraft>(() => createVaultKeyDraft())
	const [defaultLocation, setDefaultLocation] = useState<string | null>(null)
	const remotes = useAddVaultRemotes()
	const update = controller.update
	const updateKeyDraft = (next: Partial<VaultKeyDraft>) =>
		setKeyDraft((current) => ({ ...current, ...next }))

	const flow = useVaultKeyFlow({
		vaultPath: draft.entry?.path ?? null,
		draft: keyDraft,
		updateDraft: updateKeyDraft,
		onLinked: () => update({ step: "done", busy: false }),
	})
	keyFlowRef.current = flow

	useEffect(() => {
		let active = true
		void getDefaultVaultLocation().then((location) => {
			if (active) setDefaultLocation(location)
		})
		return () => {
			active = false
		}
	}, [])

	const { path, step } = draft
	const syncing = path === "download" || draft.mode === "sync"
	const steps = path ? addVaultStepsFor(path, syncing) : []
	const selectedRemote = remotes.options.find((option) => option.remote.id === draft.remoteId)
	const isNewRemote = draft.remoteId === NEW_REMOTE
	const names = resolveAddVaultNames(draft, selectedRemote?.remote.name)
	const { localName, remoteName } = names
	const parentDisplay = formatVaultPath(draft.parentPath ?? defaultLocation ?? "~/Documents/Cortex")
	const serverLabel = remotes.serverLabel
	const close = () => addVaultModal.close()

	const pickFolder = controller.pickFolder

	const autoPick = useEffectEvent(() => {
		if (path === "open" && step === "folder" && !draft.folder && !draft.picking) void pickFolder()
	})

	useEffect(() => {
		if (path === "open") autoPick()
	}, [path])

	const pickParent = controller.pickParent
	const finishLocal = () => controller.finishLocal(names)
	const startSync = () => controller.startSync(names)
	const openVault = controller.openVault

	const switchServer = () => openSettings("sync-self-host")

	const go = (nextStep: AddVaultStep) => controller.go(nextStep)
	const back = () => controller.back(steps)
	const canGoBack = controller.canGoBack(steps)
	const backButton = canGoBack ? (
		<Button variant="ghost" onClick={back} disabled={draft.busy}>
			Back
		</Button>
	) : step === "done" ? null : (
		<Button variant="ghost" onClick={close} disabled={draft.busy}>
			Cancel
		</Button>
	)

	const stepper = path ? (
		<FlowStepper
			steps={steps.map(
				(id): FlowStep => ({
					id,
					label: ADD_VAULT_STEP_LABELS[id as keyof typeof ADD_VAULT_STEP_LABELS],
				}),
			)}
			current={step}
		/>
	) : null

	if (step === "password") {
		if (keyDraft.encryptionStep === "none") {
			return (
				<FlowDialogContent aria-describedby={undefined}>
					<FlowHeader title={`Couldn’t sync ${localName}`}>{stepper}</FlowHeader>
					<FlowBody>
						<FlowError>
							{keyDraft.encryptionError ?? draft.error ?? "Something went wrong."}
						</FlowError>
					</FlowBody>
					<FlowFooter start={backButton}>
						<Button onClick={() => void startSync()} disabled={draft.busy}>
							{draft.busy ? <Spinner className="size-3.5" /> : null}
							Try again
						</Button>
					</FlowFooter>
				</FlowDialogContent>
			)
		}
		return (
			<FlowDialogContent aria-describedby={undefined}>
				<VaultKeyStepView
					draft={keyDraft}
					flow={flow}
					updateDraft={updateKeyDraft}
					targetName={remoteName}
					progress={stepper}
					onBack={() => {
						flow.reset()
						back()
					}}
					onClose={close}
					submitLabel={
						path === "download"
							? "Unlock & download"
							: draft.linkedRemoteName
								? "Create & sync"
								: "Unlock & sync"
					}
				/>
			</FlowDialogContent>
		)
	}

	const titles: Record<AddVaultStep, string> = {
		choose: "Add a vault",
		name: "New vault",
		folder: "Open a folder as a vault",
		sync: `Sync ${localName || "this vault"}?`,
		remote:
			path === "download"
				? "Which vault do you want on this Mac?"
				: "Sync with which remote vault?",
		location: "Where should it live?",
		password: "",
		done: path === "download" ? `${localName} is on its way` : `${localName} is ready`,
	}
	const leads: Record<AddVaultStep, string> = {
		choose:
			"A vault is a folder of Markdown notes on this Mac. Syncing is optional and can be added later.",
		name: "Cortex creates the folder for you.",
		folder: "Pick a folder with notes, or an empty one.",
		sync: "Syncing links this folder to a remote vault so your other devices get the same notes.",
		remote:
			path === "download"
				? "These are in your account but not on this Mac."
				: "Pick one you already have, or create a new one.",
		location: "Cortex makes a local folder for it.",
		password: "",
		done: "Here’s what was set up.",
	}

	let primary: { label: string; onClick: () => void; disabled?: boolean } | null = null
	let alternate: { label: string; onClick: () => void } | null = null
	const syncedOn = `With “${draft.linkedRemoteName ?? remoteName}” on ${serverLabel}`
	switch (step) {
		case "name":
			primary = { label: "Next: sync", onClick: () => go("sync"), disabled: !draft.name.trim() }
			break
		case "folder":
			primary = {
				label: "Next: sync",
				onClick: () => go("sync"),
				disabled: !draft.folder || draft.picking,
			}
			break
		case "sync":
			primary =
				draft.mode === "keep"
					? {
							label: path === "open" ? "Open as vault" : "Create vault",
							onClick: () => void finishLocal(),
						}
					: {
							label: "Next: choose remote vault",
							onClick: () => go("remote"),
							disabled: draft.mode === null,
						}
			break
		case "remote":
			primary = {
				label: path === "download" ? "Next: choose folder" : "Next: password",
				onClick: path === "download" ? () => go("location") : () => void startSync(),
				disabled:
					remotes.locked ||
					!remotes.authenticated ||
					!draft.remoteId ||
					(isNewRemote && !remoteName),
			}
			if (remotes.locked && path !== "download") {
				alternate = {
					label: "Keep on this Mac instead",
					onClick: () => {
						update({ mode: "keep" })
						void finishLocal()
					},
				}
			}
			break
		case "location":
			primary = { label: "Next: password", onClick: () => void startSync() }
			break
		case "done":
			primary = { label: `Open ${localName}`, onClick: () => void openVault() }
			break
		case "choose":
			break
	}

	const summary = [
		{ label: "Folder", value: draft.entry ? formatVaultPath(draft.entry.path) : "—" },
		{ label: "Sync", value: syncing && draft.mode !== "keep" ? syncedOn : "Only on this Mac" },
		{ label: "Encryption", value: syncing && draft.mode !== "keep" ? "On" : "—" },
	]

	return (
		<FlowDialogContent aria-describedby={undefined}>
			<FlowHeader title={titles[step]} lead={leads[step]}>
				{stepper}
			</FlowHeader>
			<FlowBody>
				{step === "choose" ? (
					<ChooseStep onPick={(nextPath: AddVaultPath) => controller.choosePath(nextPath)} />
				) : null}
				{step === "name" ? (
					<NameStep
						name={draft.name}
						color={draft.color}
						location={`${parentDisplay}/${draft.name.trim() || "Untitled"}`}
						onNameChange={(name) => update({ name })}
						onColorChange={(color) => update({ color })}
						onChangeLocation={() => void pickParent()}
						onSubmit={() => go("sync")}
					/>
				) : null}
				{step === "folder" ? (
					<FolderStep
						folder={draft.folder}
						picking={draft.picking}
						adoptObsidian={draft.adoptObsidian}
						onPick={() => void pickFolder()}
						onAdoptObsidianChange={(adoptObsidian) => update({ adoptObsidian })}
					/>
				) : null}
				{step === "sync" ? (
					<SyncChoiceStep
						mode={draft.mode}
						locked={remotes.locked}
						onChange={(mode) => update({ mode })}
					/>
				) : null}
				{step === "remote" ? (
					<RemoteStep
						authenticated={remotes.authenticated}
						loading={remotes.loading}
						locked={remotes.locked}
						selfHosted={remotes.syncConfig.selfHosted}
						serverLabel={serverLabel}
						options={remotes.options}
						selected={draft.remoteId}
						allowNew={path !== "download"}
						newRemoteName={draft.newRemoteName}
						newRemoteTarget={remotes.syncConfig.selfHosted ? "your server" : CLOUD_SERVER_LABEL}
						onSelect={(remoteId) => controller.selectRemote(remoteId, localName)}
						onNewRemoteNameChange={(newRemoteName) => update({ newRemoteName })}
						onSeePlans={remotes.openBillingPage}
						onSwitchServer={switchServer}
						onSignIn={() => openSettings("sync-account")}
					/>
				) : null}
				{step === "location" ? (
					<LocationStep
						remoteName={remoteName}
						location={`${parentDisplay}/${remoteName}`}
						onChangeLocation={() => void pickParent()}
					/>
				) : null}
				{step === "done" ? (
					<>
						<div className="flex items-center gap-3">
							<VaultTile
								name={localName}
								color={draft.entry ? resolveVaultColor(draft.entry) : draft.color}
								size="lg"
							/>
							<div className="min-w-0">
								<b className="block truncate text-[14px] leading-[19px] font-medium">{localName}</b>
								<span className="block text-[12.5px] leading-[17px] text-text-secondary">
									{summary[1]?.value}
								</span>
							</div>
						</div>
						<FlowSummary rows={summary} />
						{path === "download" ? (
							<FlowNote className="mt-3" icon={<Spinner />}>
								Downloading notes. You can open it now; the rest arrives in the background.
							</FlowNote>
						) : null}
					</>
				) : null}
				<FlowError>{draft.error}</FlowError>
			</FlowBody>
			{step === "choose" ? (
				<FlowFooter start={backButton} />
			) : (
				<FlowFooter start={backButton}>
					{alternate ? (
						<Button variant="secondary" onClick={alternate.onClick} disabled={draft.busy}>
							{alternate.label}
						</Button>
					) : null}
					{primary ? (
						<Button onClick={primary.onClick} disabled={primary.disabled || draft.busy}>
							{draft.busy ? <Spinner className="size-3.5" /> : null}
							{primary.label}
						</Button>
					) : null}
				</FlowFooter>
			)}
		</FlowDialogContent>
	)
}
