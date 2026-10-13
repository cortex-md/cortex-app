import {
	isPathOrDescendant,
	isSyncImagePath,
	shouldIgnoreSyncPath,
	toVaultRelativePath,
	useSyncStore,
	useVaultStore,
	VAULT_CONFIG_DIR,
} from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { Button, cn, FolderPicker, StatusBadge } from "@cortex/ui"
import { AsteriskIcon, FileIcon, FolderIcon, XIcon } from "lucide-react"
import { useMemo } from "react"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsGroupContent,
	SettingsIconTile,
	SettingsListItem,
	SettingsSection,
} from "./SettingsPrimitives"
import { useSettingsVaultFiles } from "./useSettingsVaultFiles"

type ExcludedPathKind = "Folder" | "File" | "Pattern"

function getExcludedPathKind(path: string): ExcludedPathKind {
	const normalized = path.replace(/^!/, "")
	if (/[*?[\]]/.test(normalized)) return "Pattern"
	return normalized.endsWith("/") ? "Folder" : "File"
}

function fileEntryToRelativePath(entry: FileEntry, vaultPath: string): string {
	const relative = toVaultRelativePath(entry.path, vaultPath) ?? entry.path
	return entry.isDir ? (relative.endsWith("/") ? relative : `${relative}/`) : relative
}

export function ExcludedPathsSettings() {
	const files = useSettingsVaultFiles()
	const vault = useVaultStore((s) => s.vault)
	const syncPreferences = useSyncStore((s) => s.syncPreferences)
	const excludedPaths = syncPreferences.excludedPaths
	const toggleExcludedPath = useSyncStore((s) => s.toggleExcludedPath)

	const availableOptions = useMemo(() => {
		if (!vault?.path) return []
		return files.flatMap((file) => {
			const path = fileEntryToRelativePath(file, vault.path)
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
	}, [files, vault?.path, syncPreferences])

	return (
		<SettingsSection
			fieldId="sync-preferences.excluded-paths"
			title="Excluded from sync"
			footer="Excluded items stay on this device and are never uploaded."
		>
			<SettingsGroup>
				<SettingsGroupContent className="settings-excluded-add">
					<FolderPicker
						options={availableOptions}
						value=""
						onChange={(path) => toggleExcludedPath(path, true)}
						placeholder="Add a folder, file or pattern"
						allowCustomValue
						getCustomValueLabel={(value) => `Add pattern "${value}"`}
					/>
				</SettingsGroupContent>
				{excludedPaths.length === 0 ? (
					<SettingsEmptyState>No excluded paths</SettingsEmptyState>
				) : (
					excludedPaths.map((path) => {
						const kind = getExcludedPathKind(path)
						return (
							<SettingsListItem key={path} data-has-icon="true">
								<SettingsIconTile>
									{kind === "Folder" ? (
										<FolderIcon />
									) : kind === "Pattern" ? (
										<AsteriskIcon />
									) : (
										<FileIcon />
									)}
								</SettingsIconTile>
								<span
									className={cn(
										"settings-member-copy settings-field-label",
										kind === "Pattern" && "font-mono",
									)}
									data-kind={kind}
								>
									{path}
								</span>
								<div className="settings-row-trail">
									<StatusBadge color="gray" dot={false}>
										{kind}
									</StatusBadge>
									<Button
										variant="ghost"
										size="icon-xs"
										onClick={() => toggleExcludedPath(path, false)}
										aria-label={`Remove ${path}`}
										className="settings-row-remove"
									>
										<XIcon />
									</Button>
								</div>
							</SettingsListItem>
						)
					})
				)}
			</SettingsGroup>
		</SettingsSection>
	)
}
