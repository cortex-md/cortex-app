export interface FixtureCommentMessage {
	id: string
	personId: string
	body: string
	minutesAgo: number
}

export interface FixtureCommentThread {
	id: string
	quote: string
	resolved: boolean
	messages: FixtureCommentMessage[]
}

export const FIXTURE_COMMENT_THREADS: FixtureCommentThread[] = [
	{
		id: "fixture-thread-words",
		quote: "Keep it under 200 words.",
		resolved: false,
		messages: [
			{
				id: "fixture-message-1",
				personId: "bruno",
				body: "Should we cut the CLI part? It is a lot for a first read.",
				minutesAgo: 10,
			},
			{
				id: "fixture-message-2",
				personId: "ana",
				body: "Keep one line about it. @[[Carla Lima]] thoughts?",
				minutesAgo: 6,
			},
		],
	},
	{
		id: "fixture-thread-invite",
		quote: "Invite list goes out Monday",
		resolved: false,
		messages: [
			{
				id: "fixture-message-3",
				personId: "carla",
				body: "Monday or Tuesday? @[[Bruno Kim]] is out Monday.",
				minutesAgo: 60,
			},
		],
	},
]

export const FIXTURE_REPLY_DRAFT = "@Ca"
