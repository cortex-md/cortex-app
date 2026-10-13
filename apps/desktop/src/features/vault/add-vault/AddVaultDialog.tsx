import {
	createDefaultSyncPreferences,
	createVaultFolder,
	getDefaultVaultLocation,
	registerVaultFolder,
	resolvePickedFolder,
	resolveVaultColor,
	useRemoteVaultStore,
	useUIStore,
	useVaultStore,
	VAULT_COLORS,
} from "@cortex/core"
import { isObsidianVault } from "@cortex/import-export"
import { getPlatform, type VaultRegistryEntry } from "@cortex/platform"
import { Button, Spinner } from "@cortex/ui"
import { useEffect, useEffectEvent, useState } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import { obsidianImportModal } from "../../import-export/obsidianImportModal"
import { CLOUD_SERVER_LABEL } from "../../sync/serverLabel"
import { useVaultKeyFlow } from "../../sync/vault-key/useVaultKeyFlow"
import { VaultKeyStepView } from "../../sync/vault-key/VaultKeyStepView"
import { createVaultKeyDraft, type VaultKeyDraft } from "../../sync/vault-key/vaultKeyDraft"
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
import {
	type AddVaultPath,
	type AddVaultTarget,
	addVaultModal,
	openRecentVault,
} from "../vaultActions"
import { formatVaultPath } from "../vaultDisplay"
import {
	ChooseStep,
	FolderStep,
	LocationStep,
	NameStep,
	NEW_REMOTE,
	type PickedFolderInfo,
	RemoteStep,
	SyncChoiceStep,
	type SyncMode,
} from "./AddVaultSteps"
import { useAddVaultRemotes } from "./useAddVaultRemotes"

type AddVaultStep =
	| "choose"
	| "name"
	| "folder"
	| "sync"
	| "remote"
	| "location"
	| "password"
	| "done"

const STEP_LABELS: Record<Exclude<AddVaultStep, "choose">, string> = {
	name: "Name",
	folder: "Folder",
	sync: "Sync",
	remote: "Remote vault",
	location: "Folder",
	password: "Password",
	done: "Done",
}

const FIRST_STEP: Record<AddVaultPath, AddVaultStep> = {
	create: "name",
	open: "folder",
	download: "remote",
}

function stepsFor(path: AddVaultPath, syncing: boolean): AddVaultStep[] {
	if (path === "download") return ["remote", "location", "password", "done"]
	const first = FIRST_STEP[path]
	return syncing ? [first, "sync", "remote", "password", "done"] : [first, "sync", "done"]
}

interface AddVaultDraft {
	path: AddVaultPath | null
	step: AddVaultStep
	name: string
	color: string
	parentPath: string | null
	folder: PickedFolderInfo | null
	picking: boolean
	adoptObsidian: boolean
	mode: SyncMode | null
	remoteId: string | null
	newRemoteName: string
	linkedRemoteName: string | null
	entry: VaultRegistryEntry | null
	busy: boolean
	error: string | null
}

function createDraft(target: AddVaultTarget): AddVaultDraft {
	const path = target.start === "choose" ? null : target.start
	return {
		path,
		step: path ? FIRST_STEP[path] : "choose",
		name: "Second brain",
		color: VAULT_COLORS[0],
		parentPath: null,
		folder: null,
		picking: false,
		adoptObsidian: true,
		mode: path === "download" ? "sync" : null,
		remoteId: target.remoteVaultId ?? null,
		newRemoteName: "",
		linkedRemoteName: null,
		entry: null,
		busy: false,
		error: null,
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function AddVaultDialogHost() {
	return (
		<ModalStoreHost store={addVaultModal}>
			{(target) => <AddVaultDialogContent key={JSON.stringify(target)} target={target} />}
		</ModalStoreHost>
	)
}

function AddVaultDialogContent({ target }: { target: AddVaultTarget }) {
	const [draft, setDraft] = useState<AddVaultDraft>(() => createDraft(target))
	const [keyDraft, setKeyDraft] = useState<VaultKeyDraft>(() => createVaultKeyDraft())
	const [defaultLocation, setDefaultLocation] = useState<string | null>(null)
	const remotes = useAddVaultRemotes()
	const createRemoteVault = useRemoteVaultStore((state) => state.createRemoteVault)
	const openSettings = useUIStore((state) => state.openSettings)
	const update = (next: Partial<AddVaultDraft>) => setDraft((current) => ({ ...current, ...next }))
	const updateKeyDraft = (next: Partial<VaultKeyDraft>) =>
		setKeyDraft((current) => ({ ...current, ...next }))

	const flow = useVaultKeyFlow({
		vaultPath: draft.entry?.path ?? null,
		draft: keyDraft,
		updateDraft: updateKeyDraft,
		onLinked: () => update({ step: "done", busy: false }),
	})

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
	const steps = path ? stepsFor(path, syncing) : []
	const stepIndex = steps.indexOf(step)
	const selectedRemote = remotes.options.find((option) => option.remote.id === draft.remoteId)
	const isNewRemote = draft.remoteId === NEW_REMOTE
	const localName =
		path === "open"
			? (draft.folder?.name ?? "")
			: path === "download"
				? (selectedRemote?.remote.name ?? draft.linkedRemoteName ?? "")
				: draft.name.trim() || "Untitled"
	const remoteName = isNewRemote
		? draft.newRemoteName.trim() || localName
		: (selectedRemote?.remote.name ?? draft.linkedRemoteName ?? "")
	const parentDisplay = formatVaultPath(draft.parentPath ?? defaultLocation ?? "~/Documents/Cortex")
	const serverLabel = remotes.serverLabel
	const close = () => addVaultModal.close()

	const pickFolder = async () => {
		update({ picking: true })
		try {
			const folderPath = await getPlatform().dialog.pickFolder()
			if (!folderPath) return
			const picked = await resolvePickedFolder(folderPath)
			if (picked.kind === "existing") {
				close()
				await openRecentVault(picked.entry)
				return
			}
			update({
				folder: {
					path: folderPath,
					displayPath: formatVaultPath(folderPath),
					name: picked.defaultName,
					noteCount: null,
					obsidian: false,
				},
			})
			const [files, obsidian] = await Promise.all([
				getPlatform()
					.vault.scanVault(folderPath)
					.catch(() => []),
				isObsidianVault(folderPath).catch(() => false),
			])
			const noteCount = files.filter((file) => !file.isDir && file.path.endsWith(".md")).length
			setDraft((current) =>
				current.folder?.path === folderPath
					? { ...current, folder: { ...current.folder, noteCount, obsidian } }
					: current,
			)
		} catch (error) {
			update({ error: errorMessage(error) })
		} finally {
			update({ picking: false })
		}
	}

	const autoPick = useEffectEvent(() => {
		if (path === "open" && step === "folder" && !draft.folder && !draft.picking) void pickFolder()
	})

	useEffect(() => {
		if (path === "open") autoPick()
	}, [path])

	const pickParent = async () => {
		const parentPath = await getPlatform().dialog.pickFolder()
		if (parentPath) update({ parentPath })
	}

	const ensureEntry = async (): Promise<VaultRegistryEntry> => {
		if (draft.entry) return draft.entry
		const folderPath =
			path === "open" && draft.folder
				? draft.folder.path
				: await createVaultFolder(draft.parentPath, localName)
		const entry = await registerVaultFolder(folderPath, {
			name: localName,
			color: path === "create" ? draft.color : null,
			syncPreferences: createDefaultSyncPreferences(),
		})
		update({ entry })
		return entry
	}

	const run = async (task: () => Promise<void>) => {
		update({ busy: true, error: null })
		try {
			await task()
		} catch (error) {
			update({ error: errorMessage(error) })
		} finally {
			update({ busy: false })
		}
	}

	const finishLocal = () =>
		run(async () => {
			await ensureEntry()
			update({ step: "done" })
		})

	const startSync = () =>
		run(async () => {
			const entry = await ensureEntry()
			let remoteVaultId = draft.remoteId
			if (!remoteVaultId) return
			if (remoteVaultId === NEW_REMOTE) {
				const created = await createRemoteVault(remoteName, null)
				remoteVaultId = created.id
				update({ remoteId: created.id, linkedRemoteName: created.name })
			} else {
				update({ linkedRemoteName: remoteName })
			}
			update({ step: "password" })
			await flow.link(remoteVaultId, entry.path)
		})

	const openVault = async () => {
		const entry = draft.entry
		if (!entry) return
		const opensHere = useVaultStore.getState().vault === null
		close()
		await openRecentVault(entry, "auto", {
			createOnboardingNote: path === "create" || (path === "open" && draft.folder?.noteCount === 0),
		})
		if (opensHere && draft.folder?.obsidian && draft.adoptObsidian) {
			obsidianImportModal.open({ mode: "adopt" })
		}
	}

	const switchServer = () => openSettings("sync-self-host")

	const go = (nextStep: AddVaultStep) => update({ step: nextStep, error: null })
	const back = () => {
		if (step === "done" && draft.mode === "keep") return go("sync")
		if (stepIndex > 0) return go(steps[stepIndex - 1] ?? "choose")
		if (target.start === "choose") update({ path: null, step: "choose", error: null })
	}
	const canGoBack =
		step !== "choose" &&
		(step !== "done" || draft.mode === "keep") &&
		(stepIndex > 0 || target.start === "choose")
	const backButton = canGoBack ? (
		<Button variant="ghost" size="sm" onClick={back} disabled={draft.busy}>
			Back
		</Button>
	) : step === "done" ? null : (
		<Button variant="ghost" size="sm" onClick={close} disabled={draft.busy}>
			Cancel
		</Button>
	)

	const stepper = path ? (
		<FlowStepper
			steps={steps.map(
				(id): FlowStep => ({ id, label: STEP_LABELS[id as keyof typeof STEP_LABELS] }),
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
						<Button size="sm" onClick={() => void startSync()} disabled={draft.busy}>
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
					<ChooseStep
						onPick={(nextPath) =>
							update({
								path: nextPath,
								step: FIRST_STEP[nextPath],
								mode: nextPath === "download" ? "sync" : null,
								remoteId: null,
								error: null,
							})
						}
					/>
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
						onSelect={(remoteId) =>
							update({
								remoteId,
								newRemoteName:
									remoteId === NEW_REMOTE ? draft.newRemoteName || localName : draft.newRemoteName,
							})
						}
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
						<Button variant="secondary" size="sm" onClick={alternate.onClick} disabled={draft.busy}>
							{alternate.label}
						</Button>
					) : null}
					{primary ? (
						<Button size="sm" onClick={primary.onClick} disabled={primary.disabled || draft.busy}>
							{draft.busy ? <Spinner className="size-3.5" /> : null}
							{primary.label}
						</Button>
					) : null}
				</FlowFooter>
			)}
		</FlowDialogContent>
	)
}
