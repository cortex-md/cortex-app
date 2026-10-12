import { splitMentions } from "@cortex/comments"
import { useMemo } from "react"
import { MentionChip } from "./MentionChip"
import type { CommentPerson } from "./useCommentPeople"

interface CommentBodyProps {
	body: string
	people: readonly CommentPerson[]
}

function findPersonByName(people: readonly CommentPerson[], name: string): CommentPerson | null {
	const normalized = name.toLocaleLowerCase()
	return people.find((person) => person.name.toLocaleLowerCase() === normalized) ?? null
}

export function CommentBody({ body, people }: CommentBodyProps) {
	const segments = useMemo(() => splitMentions(body), [body])
	return (
		<p className="comment-body">
			{segments.map((segment) =>
				segment.kind === "mention" ? (
					<MentionChip
						key={segment.start}
						name={segment.text}
						person={findPersonByName(people, segment.text)}
					/>
				) : (
					<span key={segment.start}>{segment.text}</span>
				),
			)}
		</p>
	)
}
