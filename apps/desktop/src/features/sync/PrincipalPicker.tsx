import type { VaultGroup, VaultMember } from "@cortex/platform"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cortex/ui"
import { PlusIcon, UsersIcon } from "lucide-react"
import { useState } from "react"
import { formatCount } from "@/utils/format"
import { memberDisplayName } from "./memberDirectory"
import { UserAvatar } from "./UserAvatar"

export type PrincipalSelection =
	| { principalType: "user"; principalId: string }
	| { principalType: "group"; principalId: string }

interface PrincipalPickerProps {
	members: readonly VaultMember[]
	groups?: readonly VaultGroup[]
	excludedUserIds?: ReadonlySet<string>
	excludedGroupIds?: ReadonlySet<string>
	label: string
	placeholder?: string
	disabled?: boolean
	onSelect(selection: PrincipalSelection): void
}

const NO_IDS: ReadonlySet<string> = new Set()

export function PrincipalPicker({
	members,
	groups = [],
	excludedUserIds = NO_IDS,
	excludedGroupIds = NO_IDS,
	label,
	placeholder = "Search people and groups",
	disabled,
	onSelect,
}: PrincipalPickerProps) {
	const [open, setOpen] = useState(false)
	const availableMembers = members.filter((member) => !excludedUserIds.has(member.userId))
	const availableGroups = groups.filter((group) => !excludedGroupIds.has(group.id))

	const select = (selection: PrincipalSelection) => {
		onSelect(selection)
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="secondary" disabled={disabled}>
					<PlusIcon />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" sideOffset={4} className="principal-picker-popover">
				<Command className="principal-picker-command">
					<CommandInput autoFocus placeholder={placeholder} />
					<CommandList>
						{availableGroups.length > 0 && (
							<CommandGroup heading="Groups">
								{availableGroups.map((group) => (
									<CommandItem
										key={group.id}
										value={`group ${group.name} ${group.id}`}
										onSelect={() => select({ principalType: "group", principalId: group.id })}
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
						{availableMembers.length > 0 && (
							<CommandGroup heading="People">
								{availableMembers.map((member) => (
									<CommandItem
										key={member.userId}
										value={`user ${member.displayName} ${member.email} ${member.userId}`}
										onSelect={() => select({ principalType: "user", principalId: member.userId })}
									>
										<UserAvatar
											name={memberDisplayName(member)}
											avatarUrl={member.avatarUrl}
											size="sm"
										/>
										<span className="principal-picker-name">{memberDisplayName(member)}</span>
										<small>{member.email}</small>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						<CommandEmpty>No one left to add</CommandEmpty>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
