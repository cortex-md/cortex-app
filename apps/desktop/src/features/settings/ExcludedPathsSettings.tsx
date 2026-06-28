import { isSyncImagePath, shouldIgnoreSyncPath, useSyncStore, useVaultStore } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { Badge, Button, FolderPicker } from "@cortex/ui"
import { FileIcon, FolderIcon, XIcon } from "lucide-react"
import { useMemo } from "react"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsGroupContent,
	SettingsSection,
} from "./SettingsPrimitives"

function fileEntryToRelativePath(entry: FileEntry, vaultPath: string): string {
	const relative = entry.path.replace(`${vaultPath}/`, "")
	return entry.isDir ? (relative.endsWith("/") ? relative : `${relative}/`) : relative
}

export function ExcludedPathsSettings() {
	const files = useVaultStore((s) => s.files)
	const vault = useVaultStore((s) => s.vault)
	const syncPreferences = useSyncStore((s) => s.syncPreferences)
	const excludedPaths = syncPreferences.excludedPaths
	const toggleExcludedPath = useSyncStore((s) => s.toggleExcludedPath)

	const availableOptions = useMemo(() => {
		if (!vault?.path) return []
		return files.flatMap((file) => {
			const path = fileEntryToRelativePath(file, vault.path)
			if (path.startsWith(".cortex/") || path.startsWith(".cortex")) return []
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
			title="Excluded from Sync"
			description="Files, folders, and patterns excluded from sync will not be uploaded to the remote vault."
		>
			<SettingsGroup>
				<SettingsGroupContent>
					{excludedPaths.length > 0 && (
						<div className="mb-3 flex flex-wrap gap-1.5">
							{excludedPaths.map((path) => (
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
										aria-label={`Remove ${path}`}
										className="-mr-0.5 ml-0.5 size-5"
									>
										<XIcon className="size-3" />
									</Button>
								</Badge>
							))}
						</div>
					)}
					{excludedPaths.length === 0 && (
						<SettingsEmptyState className="px-0 pt-0">No excluded paths</SettingsEmptyState>
					)}

					<FolderPicker
						options={availableOptions}
						value=""
						onChange={(path) => toggleExcludedPath(path, true)}
						placeholder="Search files, folders, or add a pattern..."
						allowCustomValue
						getCustomValueLabel={(value) => `Add pattern "${value}"`}
						reserveDropdownSpace
					/>
				</SettingsGroupContent>
			</SettingsGroup>
		</SettingsSection>
	)
}
