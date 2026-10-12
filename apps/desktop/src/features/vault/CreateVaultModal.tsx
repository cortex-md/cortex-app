import {
	createDefaultSyncPreferences,
	createVaultFromFolder,
	isPathOrDescendant,
	isSyncImagePath,
	normalizeSyncPathPattern,
	reportAppError,
	shouldIgnoreSyncPath,
	toVaultRelativePath,
	VAULT_CONFIG_DIR,
} from "@cortex/core"
import type { FileEntry, SyncPreferences } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	Badge,
	Button,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	FieldGroup,
	FieldLabel,
	FolderPicker,
	type IconName,
	IconPicker,
	Input,
	Label,
	Switch,
} from "@cortex/ui"
import { FileIcon, FolderIcon, XIcon } from "lucide-react"
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import { createVaultModal } from "./createVaultModalStore"

interface CreateVaultModalContentProps {
	folderPath: string
	defaultName: string
}

type CreateVaultStep = "identity" | "preferences"

interface CreateVaultDraft {
	step: CreateVaultStep
	name: string
	icon: IconName | undefined
	files: FileEntry[]
	syncPreferences: SyncPreferences
	creating: boolean
}

function fileEntryToRelativePath(entry: FileEntry, vaultPath: string): string {
	const relative = toVaultRelativePath(entry.path, vaultPath) ?? entry.path
	return entry.isDir ? (relative.endsWith("/") ? relative : `${relative}/`) : relative
}

function createVaultDraft(defaultName: string): CreateVaultDraft {
	return {
		step: "identity",
		name: defaultName,
		icon: undefined,
		files: [],
		syncPreferences: createDefaultSyncPreferences(),
		creating: false,
	}
}

export function CreateVaultModalHost() {
	return (
		<ModalStoreHost store={createVaultModal}>
			{(target) => (
				<CreateVaultModalContent
					key={target.folderPath}
					folderPath={target.folderPath}
					defaultName={target.defaultName}
				/>
			)}
		</ModalStoreHost>
	)
}

function CreateVaultModalContent({ folderPath, defaultName }: CreateVaultModalContentProps) {
	const [draft, setDraft] = useState<CreateVaultDraft>(() => createVaultDraft(defaultName))
	const { step, name, icon, files, syncPreferences, creating } = draft

	useEffect(() => {
		let active = true
		getPlatform()
			.vault.scanVault(folderPath)
			.then((nextFiles) => {
				if (active) setDraft((current) => ({ ...current, files: nextFiles }))
			})
			.catch(() => {
				if (active) setDraft((current) => ({ ...current, files: [] }))
			})
		return () => {
			active = false
		}
	}, [folderPath])

	const availableOptions = useMemo(() => {
		return files.flatMap((file) => {
			const path = fileEntryToRelativePath(file, folderPath)
			if (isPathOrDescendant(path, VAULT_CONFIG_DIR)) return []
			if (syncPreferences.ignoreImages && isSyncImagePath(path)) return []
			if (shouldIgnoreSyncPath(path, syncPreferences)) return []
			return [
				{
					value: path,
					label: path,
					isDir: path.endsWith("/"),
				},
			]
		})
	}, [files, folderPath, syncPreferences])

	const updateSyncPreference = (
		key: keyof Omit<SyncPreferences, "excludedPaths">,
		value: boolean,
	) => {
		setDraft((current) => ({
			...current,
			syncPreferences: { ...current.syncPreferences, [key]: value },
		}))
	}

	const toggleExcludedPath = (path: string, excluded: boolean) => {
		const pattern = normalizeSyncPathPattern(path)
		if (!pattern) return
		setDraft((current) => ({
			...current,
			syncPreferences: {
				...current.syncPreferences,
				excludedPaths: excluded
					? Array.from(new Set([...current.syncPreferences.excludedPaths, pattern]))
					: current.syncPreferences.excludedPaths.filter((entry) => entry !== pattern),
			},
		}))
	}

	const handleIdentitySubmit = (event: FormEvent) => {
		event.preventDefault()
		setDraft((current) => ({ ...current, step: "preferences" }))
	}

	const handleCreate = async () => {
		setDraft((current) => ({ ...current, creating: true }))
		try {
			await createVaultFromFolder(folderPath, { name, icon, syncPreferences })
			createVaultModal.close()
		} catch (error) {
			await reportAppError({
				operation: "create-vault",
				source: "create-vault-modal",
				cause: error,
				userMessage: "The vault could not be created.",
				context: { folderPath },
			})
		} finally {
			setDraft((current) => ({ ...current, creating: false }))
		}
	}

	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[680px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>Create new vault</DialogTitle>
				<DialogDescription>
					{step === "identity"
						? "Customize your vault the way you want."
						: "Set sync preferences before this vault connects to any remote."}
				</DialogDescription>
			</DialogHeader>
			{step === "identity" ? (
				<form onSubmit={handleIdentitySubmit}>
					<DialogBody className="dialog-chrome-body">
						<FieldGroup>
							<Field>
								<Label htmlFor="vault-name">Name</Label>
								<Input
									id="vault-name"
									value={name}
									onChange={(event: ChangeEvent<HTMLInputElement>) =>
										setDraft((current) => ({ ...current, name: event.target.value }))
									}
									placeholder="Second brain"
								/>
							</Field>
							<Field>
								<Label>Icon</Label>
								<IconPicker
									value={icon}
									onValueChange={(nextIcon) =>
										setDraft((current) => ({ ...current, icon: nextIcon }))
									}
								/>
							</Field>
						</FieldGroup>
					</DialogBody>
					<DialogFooter className="dialog-chrome-footer">
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button type="submit">Continue</Button>
					</DialogFooter>
				</form>
			) : (
				<div>
					<DialogBody className="dialog-chrome-body">
						<FieldGroup>
							<Field orientation="horizontal" className="items-center justify-between py-2">
								<FieldLabel htmlFor="new-vault-ignore-images">Ignore images</FieldLabel>
								<Switch
									id="new-vault-ignore-images"
									checked={syncPreferences.ignoreImages}
									onCheckedChange={(checked) => updateSyncPreference("ignoreImages", checked)}
								/>
							</Field>
							<Field orientation="horizontal" className="items-center justify-between py-2">
								<FieldLabel htmlFor="new-vault-sync-settings">Sync app settings</FieldLabel>
								<Switch
									id="new-vault-sync-settings"
									checked={syncPreferences.syncSettings}
									onCheckedChange={(checked) => updateSyncPreference("syncSettings", checked)}
								/>
							</Field>
							<Field orientation="horizontal" className="items-center justify-between py-2">
								<FieldLabel htmlFor="new-vault-sync-workspace">Sync workspace layout</FieldLabel>
								<Switch
									id="new-vault-sync-workspace"
									checked={syncPreferences.syncWorkspace}
									onCheckedChange={(checked) => updateSyncPreference("syncWorkspace", checked)}
								/>
							</Field>
							<Field orientation="horizontal" className="items-center justify-between py-2">
								<FieldLabel htmlFor="new-vault-sync-bookmarks">Sync bookmarks</FieldLabel>
								<Switch
									id="new-vault-sync-bookmarks"
									checked={syncPreferences.syncBookmarks}
									onCheckedChange={(checked) => updateSyncPreference("syncBookmarks", checked)}
								/>
							</Field>
							<Field>
								<FieldLabel>Excluded paths</FieldLabel>
								{syncPreferences.excludedPaths.length > 0 && (
									<div className="mb-3 flex flex-wrap gap-1.5">
										{syncPreferences.excludedPaths.map((path) => (
											<Badge
												key={path}
												variant="secondary"
												className="flex items-center gap-1.5 py-1 pr-1 pl-2"
											>
												{path.replace(/^!/, "").endsWith("/") ? (
													<FolderIcon className="size-3 shrink-0 text-text-muted" />
												) : (
													<FileIcon className="size-3 shrink-0 text-text-muted" />
												)}
												<span className="text-xs">{path}</span>
												<Button
													variant="ghost"
													size="icon-xs"
													onClick={() => toggleExcludedPath(path, false)}
													className="ml-0.5 size-4 rounded-sm p-0.5 hover:bg-bg-hover"
													aria-label={`Remove ${path}`}
												>
													<XIcon className="size-3" />
												</Button>
											</Badge>
										))}
									</div>
								)}
								<FolderPicker
									options={availableOptions}
									value=""
									onChange={(path) => toggleExcludedPath(path, true)}
									placeholder="Search files, folders, or add a pattern..."
									allowCustomValue
									getCustomValueLabel={(value) => `Add pattern "${value}"`}
								/>
							</Field>
						</FieldGroup>
					</DialogBody>
					<DialogFooter className="dialog-chrome-footer">
						<Button
							variant="ghost"
							onClick={() => setDraft((current) => ({ ...current, step: "identity" }))}
							disabled={creating}
						>
							Back
						</Button>
						<Button onClick={handleCreate} disabled={creating}>
							{creating ? "Creating..." : "Create vault"}
						</Button>
					</DialogFooter>
				</div>
			)}
		</DialogContent>
	)
}
