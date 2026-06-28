import {
	createDefaultSyncPreferences,
	isSyncImagePath,
	normalizeSyncPathPattern,
	shouldIgnoreSyncPath,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import type { FileEntry, SyncPreferences } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	Badge,
	Button,
	Dialog,
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

interface CreateVaultModalProps {
	open: boolean
	folderPath: string
	onOpenChange: (open: boolean) => void
}

interface CreateVaultModalContentProps {
	folderPath: string
	onOpenChange: (open: boolean) => void
}

type CreateVaultStep = "identity" | "preferences"

interface CreateVaultDraft {
	step: CreateVaultStep
	name: string
	color: string
	icon: IconName | undefined
	files: FileEntry[]
	syncPreferences: SyncPreferences
	creating: boolean
}

function fileEntryToRelativePath(entry: FileEntry, vaultPath: string): string {
	const relative = entry.path.replace(`${vaultPath}/`, "")
	return entry.isDir ? (relative.endsWith("/") ? relative : `${relative}/`) : relative
}

function createVaultDraft(defaultName: string): CreateVaultDraft {
	return {
		step: "identity",
		name: defaultName,
		color: "#fb7185",
		icon: undefined,
		files: [],
		syncPreferences: createDefaultSyncPreferences(),
		creating: false,
	}
}

export function CreateVaultModal({ open, folderPath, onOpenChange }: CreateVaultModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && (
				<CreateVaultModalContent
					key={folderPath}
					folderPath={folderPath}
					onOpenChange={onOpenChange}
				/>
			)}
		</Dialog>
	)
}

function CreateVaultModalContent({ folderPath, onOpenChange }: CreateVaultModalContentProps) {
	const openVault = useVaultStore((state) => state.openVault)
	const saveSyncPreferences = useSyncStore((state) => state.saveSyncPreferences)
	const defaultName = folderPath.split("/").pop() || "My Vault"

	const [draft, setDraft] = useState<CreateVaultDraft>(() => createVaultDraft(defaultName))
	const { step, name, color, icon, files, syncPreferences, creating } = draft

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
			if (path.startsWith(".cortex/") || path === ".cortex") return []
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
			await openVault(folderPath, {
				icon: icon ?? undefined,
				color,
				name,
				createOnboardingNote: true,
			})
			await saveSyncPreferences(folderPath, syncPreferences)
			onOpenChange(false)
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
							<div className="grid grid-cols-2 gap-4">
								<Field>
									<Label htmlFor="vault-color">Color</Label>
									<Input
										id="vault-color"
										type="color"
										value={color}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDraft((current) => ({ ...current, color: event.target.value }))
										}
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
							</div>
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
												<button
													type="button"
													onClick={() => toggleExcludedPath(path, false)}
													className="ml-0.5 rounded-sm p-0.5 hover:bg-bg-hover"
												>
													<XIcon className="size-3" />
												</button>
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
