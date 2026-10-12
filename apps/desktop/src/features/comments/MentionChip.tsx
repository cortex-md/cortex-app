import { Tooltip, TooltipContent, TooltipTrigger } from "@cortex/ui"
import { UserAvatar } from "../sync/UserAvatar"
import type { CommentPerson } from "./useCommentPeople"

interface MentionChipProps {
	name: string
	person: CommentPerson | null
}

export function MentionChip({ name, person }: MentionChipProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="comment-mention" data-unknown={person ? undefined : "true"}>
					@{name}
				</span>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6} className="comment-person-card">
				<UserAvatar name={person?.name ?? name} avatarUrl={person?.avatarUrl} size="sm" />
				<span className="comment-person-card-copy">
					<b>{person?.name ?? name}</b>
					<small>{person ? (person.role ?? "Member") : "Not a member of this vault"}</small>
				</span>
			</TooltipContent>
		</Tooltip>
	)
}
