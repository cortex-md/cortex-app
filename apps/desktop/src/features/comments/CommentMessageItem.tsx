import type { CommentMessage } from "@cortex/comments"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Message,
	MessageAvatar,
	MessageContent,
	MessageHeader,
} from "@cortex/ui"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { memo, useState } from "react"
import { useMinuteNow } from "@/hooks/useMinuteNow"
import { formatRelativeTime } from "@/utils/format"
import { UserAvatar } from "../sync/UserAvatar"
import { CommentBody } from "./CommentBody"
import { CommentComposer } from "./CommentComposer"
import { type CommentPerson, findCommentPerson } from "./useCommentPeople"

interface CommentMessageItemProps {
	message: CommentMessage
	people: readonly CommentPerson[]
	canEdit: boolean
	onEdit: (messageId: string, body: string) => Promise<void>
	onDelete: (messageId: string) => Promise<void>
}

export const CommentMessageItem = memo(function CommentMessageItem({
	message,
	people,
	canEdit,
	onEdit,
	onDelete,
}: CommentMessageItemProps) {
	const now = useMinuteNow()
	const [editing, setEditing] = useState(false)
	const author = findCommentPerson(people, message.authorId)
	const deleted = message.deletedAt !== null

	return (
		<Message className="comment-message">
			<MessageAvatar className="comment-message-avatar">
				<UserAvatar name={author.name} avatarUrl={author.avatarUrl} size="sm" />
			</MessageAvatar>
			<MessageContent className="comment-message-content">
				<MessageHeader className="comment-message-header">
					<span className="comment-message-author">{author.name}</span>
					<time dateTime={new Date(message.createdAt).toISOString()}>
						{formatRelativeTime(message.createdAt, now)}
						{message.editedAt !== null && !deleted ? " · edited" : ""}
					</time>
					{canEdit && !deleted && !editing && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									className="comment-message-menu"
									aria-label="Comment actions"
								>
									<EllipsisIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => setEditing(true)}>
									<PencilIcon />
									Edit
								</DropdownMenuItem>
								<DropdownMenuItem variant="destructive" onSelect={() => void onDelete(message.id)}>
									<Trash2Icon />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</MessageHeader>
				{deleted ? (
					<p className="comment-body comment-body--deleted">Message deleted</p>
				) : editing ? (
					<CommentComposer
						people={people}
						placeholder="Edit comment"
						submitLabel="Save"
						initialValue={message.body}
						autoFocus
						onSubmit={async (body) => {
							await onEdit(message.id, body)
							setEditing(false)
						}}
						onCancel={() => setEditing(false)}
					/>
				) : (
					<CommentBody body={message.body} people={people} />
				)}
			</MessageContent>
		</Message>
	)
})
