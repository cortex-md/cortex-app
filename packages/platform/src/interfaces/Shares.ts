export interface NoteShareInfo {
	id: string
	vaultId: string
	filePath: string
	link: string | null
	revision: number
	sizeBytes: number
	expiresAt: string | null
	createdBy: string
	updatedAt: string
}

export interface SharedNoteAttachment {
	path: string
	type: string
	data: string
}

export interface SharedNoteBundle {
	v: 1
	title: string
	markdown: string
	html: string
	attachments: SharedNoteAttachment[]
	author?: string | null
	tags?: string[]
}

export interface Shares {
	list(vaultId: string): Promise<NoteShareInfo[]>
	publish(
		vaultId: string,
		filePath: string,
		bundle: SharedNoteBundle,
		expiresAt?: string | null,
	): Promise<NoteShareInfo>
	updateExpiry(vaultId: string, shareId: string, expiresAt: string | null): Promise<NoteShareInfo>
	revoke(vaultId: string, shareId: string): Promise<void>
	open(shareId: string, key: string): Promise<SharedNoteBundle>
}
