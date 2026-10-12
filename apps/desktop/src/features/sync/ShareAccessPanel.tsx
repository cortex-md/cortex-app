import {
	findAccessRule,
	findInheritedRestriction,
	useAccessStore,
	useMembersStore,
	useServerCapabilities,
} from "@cortex/core"
import type {
	AccessEntry,
	AccessLevel,
	AccessRule,
	VaultGroup,
	VaultInvite,
	VaultMember,
} from "@cortex/platform"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	NativeSelect,
	NativeSelectOption,
	Spinner,
} from "@cortex/ui"
import { ChevronDownIcon, InfoIcon, LockIcon, UsersIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import {
	SettingsGroup,
	SettingsIconTile,
	SettingsList,
	SettingsListItem,
} from "../settings/SettingsPrimitives"
import { AddPeopleField, type AddTarget } from "./AddPeopleField"
import { InviteLinkField } from "./InviteLinkField"
import {
	memberDisplayName,
	messageOf,
	useGroupDirectory,
	useMemberDirectory,
} from "./memberDirectory"
import { UserAvatar } from "./UserAvatar"

type AccessTargetKind = "folder" | "note"

const LEVEL_LABELS: Record<AccessLevel, string> = { view: "Can view", edit: "Can edit" }
const NO_ENTRIES: AccessEntry[] = []

function entryKey(entry: Pick<AccessEntry, "principalType" | "principalId">): string {
	return `${entry.principalType}:${entry.principalId}`
}

function folderName(path: string): string {
	return path.replace(/\/$/, "") || "Vault root"
}

interface ShareAccessPanelProps {
	vaultId: string
	path: string
	kind: AccessTargetKind
	canManage: boolean
}

export function ShareAccessPanel({ vaultId, path, kind, canManage }: ShareAccessPanelProps) {
	const accessRules = useMembersStore((state) => state.accessRules)
	const members = useMembersStore((state) => state.members)
	const groups = useMembersStore((state) => state.groups)
	const overviewVault = useMembersStore((state) => state.overviewVault)
	const setAccessRule = useMembersStore((state) => state.setAccessRule)
	const createInvite = useMembersStore((state) => state.createInvite)
	const capabilities = useServerCapabilities()
	const memberDirectory = useMemberDirectory()
	const groupDirectory = useGroupDirectory()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [invite, setInvite] = useState<VaultInvite | null>(null)

	const rule = findAccessRule(accessRules, path)
	const inherited = findInheritedRestriction(accessRules, path)
	const restricted = rule?.restricted ?? false
	const entries = rule?.entries ?? NO_ENTRIES
	const listedIds = useMemo(() => new Set(entries.map((entry) => entry.principalId)), [entries])
	const guestsAvailable =
		capabilities?.features.guests !== false && overviewVault?.allowGuests !== false
	const showList = canManage || accessRules.length > 0

	const save = async (next: AccessRule) => {
		setBusy(true)
		setError(null)
		try {
			await setAccessRule(vaultId, next)
		} catch (cause) {
			setError(messageOf(cause))
		} finally {
			setBusy(false)
		}
	}

	const updateEntries = (nextEntries: AccessEntry[]) =>
		void save({ path, restricted, entries: nextEntries })

	const add = async (target: AddTarget, level: AccessLevel): Promise<string | null> => {
		setInvite(null)
		try {
			if (target.kind === "invite") {
				setInvite(
					await createInvite(vaultId, target.email, "guest", "", {
						grants: [{ path, canWrite: level === "edit" }],
					}),
				)
				return null
			}
			const entry: AccessEntry =
				target.kind === "user"
					? { principalType: "user", principalId: target.member.userId, level }
					: { principalType: "group", principalId: target.group.id, level }
			await setAccessRule(vaultId, {
				path,
				restricted,
				entries: [...entries.filter((item) => entryKey(item) !== entryKey(entry)), entry],
			})
			return null
		} catch (cause) {
			return messageOf(cause)
		}
	}

	return (
		<div className="grid gap-4">
			{canManage ? (
				<AddPeopleField
					kind={kind}
					members={members}
					groups={groups}
					listedIds={listedIds}
					guestsAvailable={guestsAvailable}
					onAdd={add}
				/>
			) : (
				<MyAccessLine path={path} kind={kind} />
			)}
			{invite && (
				<SettingsGroup>
					<InviteLinkField invite={invite} emailEnabled={capabilities?.features.email !== false} />
				</SettingsGroup>
			)}
			{!showList && <p className="share-muted">Only vault admins can change who has access.</p>}
			{showList && (
				<div className="grid gap-2">
					<div className="share-section-label">
						<span>Who has access</span>
						{busy && <Spinner className="size-3" />}
					</div>
					<SettingsGroup>
						<SettingsList>
							<GeneralAccessRow
								path={path}
								kind={kind}
								restricted={restricted}
								inheritedFrom={inherited ? folderName(inherited.path) : null}
								readOnly={!canManage}
								disabled={busy}
								onChange={(next) => void save({ path, restricted: next, entries })}
							/>
							{entries.map((entry) => (
								<AccessEntryRow
									key={entryKey(entry)}
									entry={entry}
									member={memberDirectory.get(entry.principalId)}
									group={groupDirectory.get(entry.principalId)}
									canManage={canManage}
									busy={busy}
									onChangeLevel={(level) =>
										updateEntries(
											entries.map((candidate) =>
												entryKey(candidate) === entryKey(entry)
													? { ...candidate, level }
													: candidate,
											),
										)
									}
									onRemove={() =>
										updateEntries(
											entries.filter((candidate) => entryKey(candidate) !== entryKey(entry)),
										)
									}
								/>
							))}
						</SettingsList>
					</SettingsGroup>
					{error && <p className="settings-section-error">{error}</p>}
					<p className="share-muted">
						{canManage
							? "Vault admins always have access."
							: "Vault admins always have access. Only they can change who has access."}
					</p>
				</div>
			)}
		</div>
	)
}

function MyAccessLine({ path, kind }: { path: string; kind: AccessTargetKind }) {
	const level = useAccessStore((state) => state.evaluator.levelOf(path, path.endsWith("/")))
	const summary =
		level === "edit"
			? `You can edit this ${kind}.`
			: level === "view"
				? `You can view this ${kind}.`
				: `You don't have access to this ${kind}.`
	return (
		<p className="flex items-center gap-2 text-[13px] text-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
			<LockIcon aria-hidden="true" />
			{summary}
		</p>
	)
}

interface GeneralAccessRowProps {
	path: string
	kind: AccessTargetKind
	restricted: boolean
	inheritedFrom: string | null
	readOnly: boolean
	disabled: boolean
	onChange(restricted: boolean): void
}

function GeneralAccessRow({
	path,
	kind,
	restricted,
	inheritedFrom,
	readOnly,
	disabled,
	onChange,
}: GeneralAccessRowProps) {
	const id = `general-access-${path}`
	const label = restricted ? "Only people added here" : "Everyone in the vault"
	return (
		<SettingsListItem data-has-icon="true">
			<SettingsIconTile>{restricted ? <LockIcon /> : <UsersIcon />}</SettingsIconTile>
			<div className="settings-member-copy">
				{readOnly ? (
					<>
						<span className="share-general-label">General access</span>
						<span className="settings-field-label">{label}</span>
					</>
				) : (
					<>
						<label htmlFor={id} className="share-general-label">
							General access
						</label>
						<NativeSelect
							id={id}
							size="sm"
							className="share-general-select"
							value={restricted ? "restricted" : "members"}
							disabled={disabled}
							onChange={(event) => onChange(event.target.value === "restricted")}
						>
							<NativeSelectOption value="members">Everyone in the vault</NativeSelectOption>
							<NativeSelectOption value="restricted">Only people added here</NativeSelectOption>
						</NativeSelect>
					</>
				)}
				<span className="settings-field-description">
					{restricted
						? "Hidden from everyone else except vault admins."
						: "Members open it with the access their role gives them."}
				</span>
				{inheritedFrom && (
					<span className="share-inherited">
						<InfoIcon className="size-[13px] shrink-0" aria-hidden="true" />
						Limited by the folder “{inheritedFrom}”. Only people added there can reach this {kind}.
					</span>
				)}
			</div>
		</SettingsListItem>
	)
}

interface AccessEntryRowProps {
	entry: AccessEntry
	member: VaultMember | undefined
	group: VaultGroup | undefined
	canManage: boolean
	busy: boolean
	onChangeLevel(level: AccessLevel): void
	onRemove(): void
}

function AccessEntryRow({
	entry,
	member,
	group,
	canManage,
	busy,
	onChangeLevel,
	onRemove,
}: AccessEntryRowProps) {
	const isGroup = entry.principalType === "group"
	const name = isGroup
		? (group?.name ?? "Deleted group")
		: member
			? memberDisplayName(member)
			: "Former member"
	const description = isGroup
		? formatCount(group?.memberIds.length ?? 0, "member")
		: (member?.email ?? "No longer in this vault")

	return (
		<SettingsListItem data-has-icon="true">
			{isGroup ? (
				<SettingsIconTile>
					<UsersIcon />
				</SettingsIconTile>
			) : (
				<UserAvatar name={name} avatarUrl={member?.avatarUrl} className="settings-member-avatar" />
			)}
			<div className="settings-member-copy">
				<span className="settings-field-label">{name}</span>
				{description !== name && (
					<span className="settings-field-description">
						{description}
						{!isGroup && member?.role === "guest" && " · Guest"}
					</span>
				)}
			</div>
			<div className="settings-row-trail">
				{canManage ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="xs"
								className="share-level-trigger"
								disabled={busy}
								aria-label={`Access level for ${name}`}
							>
								{LEVEL_LABELS[entry.level]}
								<ChevronDownIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuRadioGroup
								value={entry.level}
								onValueChange={(value) => onChangeLevel(value as AccessLevel)}
							>
								<DropdownMenuRadioItem value="view">{LEVEL_LABELS.view}</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="edit">{LEVEL_LABELS.edit}</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onSelect={onRemove}>
								Remove
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<span className="settings-row-kind">{LEVEL_LABELS[entry.level]}</span>
				)}
			</div>
		</SettingsListItem>
	)
}
