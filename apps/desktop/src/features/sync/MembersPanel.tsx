import { useMembersStore } from "@cortex/core"
import {
	Avatar,
	AvatarFallback,
	Badge,
	Button,
	Input,
	NativeSelect,
	NativeSelectOption,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@cortex/ui"
import { MailPlus, Trash2, UserMinus } from "lucide-react"
import { type ChangeEvent, type KeyboardEvent, useEffect, useState } from "react"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const inviteDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
})

function formatInviteDate(value: string): string {
	return inviteDateFormatter.format(new Date(value))
}

function getMemberInitials(displayName: string): string {
	const names = displayName.trim().split(/\s+/).filter(Boolean)
	if (names.length === 0) return "?"
	return names
		.slice(0, 2)
		.map((name) => name.charAt(0))
		.join("")
		.toUpperCase()
}

interface MembersPanelProps {
	vaultId: string
	currentUserRole?: string
}

export function MembersPanel({ vaultId, currentUserRole }: MembersPanelProps) {
	const members = useMembersStore((state) => state.members)
	const invites = useMembersStore((state) => state.invites)
	const loading = useMembersStore((state) => state.loading)
	const error = useMembersStore((state) => state.error)
	const fetchMembers = useMembersStore((state) => state.fetchMembers)
	const updateMemberRole = useMembersStore((state) => state.updateMemberRole)
	const removeMember = useMembersStore((state) => state.removeMember)
	const fetchInvites = useMembersStore((state) => state.fetchInvites)
	const createInvite = useMembersStore((state) => state.createInvite)
	const deleteInvite = useMembersStore((state) => state.deleteInvite)
	const clearError = useMembersStore((state) => state.clearError)

	const [inviteEmail, setInviteEmail] = useState("")
	const [inviteRole, setInviteRole] = useState("editor")
	const [inviting, setInviting] = useState(false)

	const isValidEmail = EMAIL_REGEX.test(inviteEmail.trim())
	// oxlint-disable react-doctor/no-event-handler -- members and invites load follows the selected vault and user permissions
	const canManage = currentUserRole === "owner" || currentUserRole === "admin"
	const pendingInvites = invites.filter((invite) => !invite.accepted)

	useEffect(() => {
		if (currentUserRole) {
			fetchMembers(vaultId)
		}
	}, [vaultId, fetchMembers, currentUserRole])

	useEffect(() => {
		if (canManage) {
			fetchInvites(vaultId)
		}
	}, [vaultId, fetchInvites, canManage])
	// oxlint-enable react-doctor/no-event-handler

	const handleInvite = async () => {
		if (!isValidEmail) return
		clearError()
		setInviting(true)
		try {
			await createInvite(vaultId, inviteEmail.trim(), inviteRole, "")
			setInviteEmail("")
		} catch {
		} finally {
			setInviting(false)
		}
	}

	const handleRemoveMember = async (userId: string) => {
		clearError()
		await removeMember(vaultId, userId)
	}

	const handleChangeRole = async (userId: string, newRole: string) => {
		clearError()
		await updateMemberRole(vaultId, userId, newRole)
	}

	const handleDeleteInvite = async (inviteId: string) => {
		clearError()
		await deleteInvite(vaultId, inviteId)
	}

	return (
		<div className="flex flex-col gap-5">
			{canManage && (
				<section className="rounded-[8px] border border-border bg-muted/30 p-4">
					<div className="mb-3 flex items-start gap-3">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-text">
							<MailPlus className="size-4" />
						</div>
						<div>
							<h3 className="m-0 text-sm font-semibold text-foreground">Invite a member</h3>
							<p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">
								Send access to this vault with an initial role.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Input
							className="min-w-0 flex-1"
							type="email"
							aria-label="Invite email"
							placeholder="name@example.com"
							value={inviteEmail}
							onChange={(event: ChangeEvent<HTMLInputElement>) =>
								setInviteEmail(event.target.value)
							}
							onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
								if (event.key === "Enter") void handleInvite()
							}}
						/>
						<NativeSelect
							aria-label="Invite role"
							value={inviteRole}
							onChange={(event) => setInviteRole(event.target.value)}
							className="w-32"
						>
							<NativeSelectOption value="admin">Admin</NativeSelectOption>
							<NativeSelectOption value="editor">Editor</NativeSelectOption>
							<NativeSelectOption value="viewer">Viewer</NativeSelectOption>
						</NativeSelect>
						<Button
							size="sm"
							onClick={handleInvite}
							disabled={inviting || !isValidEmail}
							className="shrink-0"
						>
							{inviting ? <Spinner className="size-3" /> : <MailPlus />}
							Send invite
						</Button>
					</div>
				</section>
			)}

			<section>
				<div className="mb-2 flex items-end justify-between px-0.5">
					<div>
						<h3 className="m-0 text-sm font-semibold text-foreground">Vault members</h3>
						<p className="m-0 mt-0.5 text-xs text-muted-foreground">
							People with current access to this vault.
						</p>
					</div>
					{members.length > 0 && (
						<Badge variant="secondary">
							{members.length} {members.length === 1 ? "member" : "members"}
						</Badge>
					)}
				</div>
				<div className="overflow-hidden rounded-[8px] border border-border bg-background">
					{loading && members.length === 0 ? (
						<div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
							<Spinner className="size-4" />
							Loading members
						</div>
					) : members.length === 0 ? (
						<div className="p-8 text-center">
							<p className="m-0 text-sm font-medium text-foreground">No members found</p>
							<p className="m-0 mt-1 text-xs text-muted-foreground">
								Invite someone to begin collaborating.
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead>Member</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
									<TableHead className="w-12 text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{members.map((member) => (
									<TableRow key={member.userId}>
										<TableCell>
											<div className="flex min-w-0 items-center gap-3">
												<Avatar>
													<AvatarFallback className="bg-brand-subtle font-medium text-brand-text">
														{getMemberInitials(member.displayName)}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0">
													<div className="truncate text-[13px] font-medium text-foreground">
														{member.displayName}
													</div>
													<div className="truncate text-xs text-muted-foreground">
														{member.email}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>
											{canManage ? (
												<NativeSelect
													size="sm"
													aria-label={`Role for ${member.displayName}`}
													value={member.role}
													onChange={(event) => handleChangeRole(member.userId, event.target.value)}
													className="w-28 capitalize"
												>
													{currentUserRole === "owner" && (
														<NativeSelectOption value="owner">Owner</NativeSelectOption>
													)}
													<NativeSelectOption value="admin">Admin</NativeSelectOption>
													<NativeSelectOption value="editor">Editor</NativeSelectOption>
													<NativeSelectOption value="viewer">Viewer</NativeSelectOption>
												</NativeSelect>
											) : (
												<Badge variant="outline" className="capitalize">
													{member.role}
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatInviteDate(member.joinedAt)}
										</TableCell>
										<TableCell className="text-right">
											{canManage && member.role !== "owner" && (
												<Button
													variant="ghost"
													size="icon-xs"
													onClick={() => handleRemoveMember(member.userId)}
													aria-label={`Remove ${member.displayName}`}
													className="h-7 w-7 text-muted-foreground hover:text-status-error-foreground"
												>
													<UserMinus />
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</div>
			</section>

			{canManage && pendingInvites.length > 0 && (
				<section>
					<div className="mb-2 flex items-end justify-between px-0.5">
						<div>
							<h3 className="m-0 text-sm font-semibold text-foreground">Pending invitations</h3>
							<p className="m-0 mt-0.5 text-xs text-muted-foreground">
								Invitations that have not been accepted yet.
							</p>
						</div>
						<Badge variant="secondary">{pendingInvites.length}</Badge>
					</div>
					<div className="overflow-hidden rounded-[8px] border border-border bg-background">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead>Invitee</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead className="w-12 text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{pendingInvites.map((invite) => (
									<TableRow key={invite.id}>
										<TableCell>
											<div className="flex items-center gap-3">
												<Avatar>
													<AvatarFallback>
														{invite.inviteeEmail.charAt(0).toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<div>
													<p className="m-0 text-[13px] font-medium text-foreground">
														{invite.inviteeEmail}
													</p>
													<p className="m-0 text-xs text-muted-foreground">Awaiting response</p>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="capitalize">
												{invite.role}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatInviteDate(invite.expiresAt)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon-xs"
												onClick={() => handleDeleteInvite(invite.id)}
												aria-label={`Cancel invite for ${invite.inviteeEmail}`}
												className="text-muted-foreground hover:text-status-error-foreground"
											>
												<Trash2 />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</section>
			)}

			{error && (
				<p className="m-0 rounded-[6px] border border-status-error-border bg-status-error-background p-3 text-xs text-status-error-foreground">
					{error}
				</p>
			)}
		</div>
	)
}
