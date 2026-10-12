import { useMembersStore } from "@cortex/core"
import type {
	MentionMenuItem,
	MentionMenuState,
	MentionPersonPreview,
} from "@cortex/editor/mentions"
import { getInitials } from "@/utils/format"
import { SlashCommandMenu } from "../split-view/SlashCommandMenu"
import { UserAvatar } from "../sync/UserAvatar"
import { toCommentPerson } from "./useCommentPeople"

export function getMentionMenuItems(): MentionMenuItem[] {
	return useMembersStore.getState().members.map((member) => {
		const person = toCommentPerson(member)
		return { id: person.userId, label: person.name, category: person.role ?? "Member" }
	})
}

export function getMentionPersonPreview(name: string): MentionPersonPreview {
	const normalized = name.toLocaleLowerCase()
	const member = useMembersStore
		.getState()
		.members.find((entry) => (entry.displayName || entry.email).toLocaleLowerCase() === normalized)
	const person = member ? toCommentPerson(member) : null
	return {
		name: person?.name ?? name,
		detail: person
			? [person.role, member?.email].filter(Boolean).join(" · ")
			: "Not a member of this vault",
		initials: getInitials(person?.name ?? name),
	}
}

export function hasMentionCandidates(): boolean {
	return useMembersStore.getState().members.length > 0
}

function MentionMenuAvatar({ item }: { item: MentionMenuItem }) {
	const avatarUrl = useMembersStore(
		(state) => state.members.find((member) => member.userId === item.id)?.avatarUrl ?? null,
	)
	return <UserAvatar name={item.label} avatarUrl={avatarUrl} size="sm" aria-hidden="true" />
}

export function MentionMenu({ state }: { state: MentionMenuState | null }) {
	return (
		<SlashCommandMenu state={state} emptyMessage="No members found" ItemIcon={MentionMenuAvatar} />
	)
}
