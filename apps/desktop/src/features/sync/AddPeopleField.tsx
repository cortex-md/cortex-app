import type { AccessLevel, VaultGroup, VaultMember } from "@cortex/platform"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	NativeSelect,
	NativeSelectOption,
	Popover,
	PopoverAnchor,
	PopoverContent,
	Spinner,
} from "@cortex/ui"
import { MailIcon, UsersIcon } from "lucide-react"
import { type KeyboardEvent, useMemo, useRef, useState } from "react"
import { formatCount } from "@/utils/format"
import { EMAIL_REGEX, isVaultAdminRole, memberDisplayName } from "./memberDirectory"
import { UserAvatar } from "./UserAvatar"

export type AddTarget =
	| { kind: "user"; member: VaultMember }
	| { kind: "group"; group: VaultGroup }
	| { kind: "invite"; email: string }

interface AddPeopleFieldProps {
	kind: string
	members: readonly VaultMember[]
	groups: readonly VaultGroup[]
	listedIds: ReadonlySet<string>
	guestsAvailable: boolean
	onAdd(target: AddTarget, level: AccessLevel): Promise<string | null>
}

interface QueryResolution {
	target: AddTarget | null
	inviteEmail: string | null
	blockedMessage: string | null
}

function targetLabel(target: AddTarget): string {
	if (target.kind === "user") return memberDisplayName(target.member)
	if (target.kind === "group") return target.group.name
	return target.email
}

function resolveQuery(
	query: string,
	members: readonly VaultMember[],
	guestsAvailable: boolean,
): QueryResolution {
	const email = query.trim().toLowerCase()
	if (!EMAIL_REGEX.test(email)) return { target: null, inviteEmail: null, blockedMessage: null }
	const member = members.find((candidate) => candidate.email.toLowerCase() === email)
	if (member && isVaultAdminRole(member.role)) {
		return {
			target: null,
			inviteEmail: null,
			blockedMessage: `${memberDisplayName(member)} is a vault admin and already has access.`,
		}
	}
	if (member) return { target: { kind: "user", member }, inviteEmail: null, blockedMessage: null }
	if (!guestsAvailable) {
		return {
			target: null,
			inviteEmail: null,
			blockedMessage: "Guests are turned off for this vault.",
		}
	}
	return { target: { kind: "invite", email }, inviteEmail: email, blockedMessage: null }
}

export function AddPeopleField({
	kind,
	members,
	groups,
	listedIds,
	guestsAvailable,
	onAdd,
}: AddPeopleFieldProps) {
	const anchorRef = useRef<HTMLDivElement>(null)
	const [query, setQuery] = useState("")
	const [selection, setSelection] = useState<AddTarget | null>(null)
	const [open, setOpen] = useState(false)
	const [level, setLevel] = useState<AccessLevel>("view")
	const [busy, setBusy] = useState(false)
	const [status, setStatus] = useState<string | null>(null)

	const availableMembers = useMemo(
		() =>
			members.filter((member) => !isVaultAdminRole(member.role) && !listedIds.has(member.userId)),
		[members, listedIds],
	)
	const availableGroups = useMemo(
		() => groups.filter((group) => !listedIds.has(group.id)),
		[groups, listedIds],
	)
	const resolution = resolveQuery(query, members, guestsAvailable)
	const target = selection ?? resolution.target

	const pick = (next: AddTarget) => {
		setSelection(next)
		setQuery(targetLabel(next))
		setOpen(false)
	}

	const submit = async () => {
		if (busy) return
		if (!target) {
			setStatus(resolution.blockedMessage)
			return
		}
		setBusy(true)
		setStatus(null)
		try {
			setStatus(await onAdd(target, level))
			setSelection(null)
			setQuery("")
		} finally {
			setBusy(false)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" || open) return
		event.preventDefault()
		void submit()
	}

	return (
		<div className="share-add">
			<Command className="share-add-row" onKeyDown={handleKeyDown}>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverAnchor asChild>
						<div ref={anchorRef} className="share-add-input">
							<CommandInput
								aria-label="Add people, groups or an email"
								placeholder="Add people, groups or an email"
								value={query}
								disabled={busy}
								onClick={() => setOpen(true)}
								onValueChange={(value) => {
									setQuery(value)
									setSelection(null)
									setStatus(null)
									setOpen(value.trim() !== "")
								}}
							/>
						</div>
					</PopoverAnchor>
					<PopoverContent
						align="start"
						className="principal-picker-popover principal-picker-command share-add-popover"
						onOpenAutoFocus={(event) => event.preventDefault()}
						onInteractOutside={(event) => {
							if (anchorRef.current?.contains(event.target as Node)) event.preventDefault()
						}}
					>
						<AddPeopleOptions
							kind={kind}
							members={availableMembers}
							groups={availableGroups}
							inviteEmail={resolution.inviteEmail}
							guestsAvailable={guestsAvailable}
							onPick={pick}
						/>
					</PopoverContent>
				</Popover>
				<NativeSelect
					aria-label="Access level"
					className="share-add-level"
					value={level}
					onChange={(event) => setLevel(event.target.value as AccessLevel)}
				>
					<NativeSelectOption value="view">Can view</NativeSelectOption>
					<NativeSelectOption value="edit">Can edit</NativeSelectOption>
				</NativeSelect>
				<Button
					disabled={busy || (!target && !resolution.blockedMessage)}
					onClick={() => void submit()}
				>
					{busy && <Spinner className="size-3" />}
					{target?.kind === "invite" ? "Invite" : "Add"}
				</Button>
			</Command>
			{status && <output className="share-muted block">{status}</output>}
		</div>
	)
}

interface AddPeopleOptionsProps {
	kind: string
	members: readonly VaultMember[]
	groups: readonly VaultGroup[]
	inviteEmail: string | null
	guestsAvailable: boolean
	onPick(target: AddTarget): void
}

function AddPeopleOptions({
	kind,
	members,
	groups,
	inviteEmail,
	guestsAvailable,
	onPick,
}: AddPeopleOptionsProps) {
	return (
		<CommandList>
			{inviteEmail && (
				<CommandGroup>
					<CommandItem
						value={`invite ${inviteEmail}`}
						onSelect={() => onPick({ kind: "invite", email: inviteEmail })}
					>
						<span className="principal-picker-group-icon">
							<MailIcon className="size-[13px]" />
						</span>
						<span className="principal-picker-name">
							Invite {inviteEmail} as a guest (only sees this {kind})
						</span>
					</CommandItem>
				</CommandGroup>
			)}
			{groups.length > 0 && (
				<CommandGroup heading="Groups">
					{groups.map((group) => (
						<CommandItem
							key={group.id}
							value={`group ${group.name} ${group.id}`}
							onSelect={() => onPick({ kind: "group", group })}
						>
							<span className="principal-picker-group-icon">
								<UsersIcon className="size-[13px]" />
							</span>
							<span className="principal-picker-name">{group.name}</span>
							<small>{formatCount(group.memberIds.length, "member")}</small>
						</CommandItem>
					))}
				</CommandGroup>
			)}
			{members.length > 0 && (
				<CommandGroup heading="People">
					{members.map((member) => (
						<CommandItem
							key={member.userId}
							value={`user ${member.displayName} ${member.email} ${member.userId}`}
							onSelect={() => onPick({ kind: "user", member })}
						>
							<UserAvatar name={memberDisplayName(member)} avatarUrl={member.avatarUrl} size="sm" />
							<span className="principal-picker-name">{memberDisplayName(member)}</span>
							<small>{member.email}</small>
						</CommandItem>
					))}
				</CommandGroup>
			)}
			<CommandEmpty>
				{guestsAvailable ? "No matches. Type an email to invite a guest." : "No matches"}
			</CommandEmpty>
		</CommandList>
	)
}
