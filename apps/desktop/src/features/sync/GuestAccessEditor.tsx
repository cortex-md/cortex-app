import { toVaultRelativePath, useVaultStore } from "@cortex/core"
import type { PathGrant } from "@cortex/platform"
import {
	Button,
	FolderPicker,
	type FolderPickerOption,
	NativeSelect,
	NativeSelectOption,
} from "@cortex/ui"
import { FileIcon, FolderIcon, XIcon } from "lucide-react"
import { useMemo } from "react"
import {
	SettingsEmptyState,
	SettingsGroupContent,
	SettingsIconTile,
	SettingsListItem,
} from "../settings/SettingsPrimitives"

interface GuestAccessEditorProps {
	grants: PathGrant[]
	disabled?: boolean
	onChange(grants: PathGrant[]): void
}

export function GuestAccessEditor({ grants, disabled, onChange }: GuestAccessEditorProps) {
	const files = useVaultStore((state) => state.files)
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const granted = useMemo(() => new Set(grants.map((grant) => grant.path)), [grants])

	const options = useMemo<FolderPickerOption[]>(() => {
		if (!vaultPath) return []
		return files.flatMap((file) => {
			if (file.name.startsWith(".")) return []
			const relative = toVaultRelativePath(file.path, vaultPath) ?? file.path
			const path = file.isDir ? `${relative}/` : relative
			return granted.has(path) ? [] : [{ value: path, label: path, isDir: file.isDir }]
		})
	}, [files, vaultPath, granted])

	return (
		<>
			<SettingsGroupContent className="settings-excluded-add">
				<FolderPicker
					options={options}
					value=""
					onChange={(path) => onChange([...grants, { path, canWrite: false }])}
					placeholder="Share a folder or note"
					reserveDropdownSpace
				/>
			</SettingsGroupContent>
			{grants.length === 0 ? (
				<SettingsEmptyState>No folders or notes shared yet</SettingsEmptyState>
			) : (
				grants.map((grant) => (
					<SettingsListItem key={grant.path} data-has-icon="true">
						<SettingsIconTile>
							{grant.path.endsWith("/") ? <FolderIcon /> : <FileIcon />}
						</SettingsIconTile>
						<span className="settings-member-copy settings-field-label">{grant.path}</span>
						<div className="settings-row-trail">
							<NativeSelect
								size="sm"
								aria-label={`Access level for ${grant.path}`}
								value={grant.canWrite ? "edit" : "view"}
								disabled={disabled}
								onChange={(event) => {
									const canWrite = event.target.value === "edit"
									onChange(
										grants.map((item) => (item.path === grant.path ? { ...item, canWrite } : item)),
									)
								}}
							>
								<NativeSelectOption value="view">Can view</NativeSelectOption>
								<NativeSelectOption value="edit">Can edit</NativeSelectOption>
							</NativeSelect>
							<Button
								variant="ghost"
								size="icon-xs"
								disabled={disabled}
								onClick={() => onChange(grants.filter((item) => item.path !== grant.path))}
								aria-label={`Stop sharing ${grant.path}`}
								className="settings-row-remove"
							>
								<XIcon />
							</Button>
						</div>
					</SettingsListItem>
				))
			)}
		</>
	)
}
