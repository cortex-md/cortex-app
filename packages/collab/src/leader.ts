export interface CollabAwarenessUser {
	id: string
	name: string
	avatarUrl: string | null
	color: string
	colorLight: string
}

export interface CollabAwarenessState {
	user?: CollabAwarenessUser
	session?: string
	canWrite?: boolean
	fileSync?: boolean
	cursor?: unknown
}

export function electFileSyncLeader(
	states: ReadonlyMap<number, CollabAwarenessState>,
	excludedSession?: string,
): number | null {
	let leader: number | null = null
	for (const [clientId, state] of states) {
		if (!state.canWrite || !state.fileSync) continue
		if (excludedSession !== undefined && state.session === excludedSession) continue
		if (leader === null || clientId < leader) leader = clientId
	}
	return leader
}
