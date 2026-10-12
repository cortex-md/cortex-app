import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"
import { hashString32 } from "./colors"
import { SEED_ORIGIN } from "./constants"
import { applyTextDiff } from "./textDiff"

export interface CollabNoteParts {
	frontmatter: string
	body: string
}

export function sameNoteParts(left: CollabNoteParts, right: CollabNoteParts): boolean {
	return left.frontmatter === right.frontmatter && left.body === right.body
}

export class CollabNoteDocument {
	readonly doc = new Y.Doc()
	readonly frontmatter = this.doc.getText("frontmatter")
	readonly body = this.doc.getText("body")
	readonly awareness = new Awareness(this.doc)
	readonly undoManager = new Y.UndoManager([this.frontmatter, this.body], {
		trackedOrigins: new Set(),
	})

	readParts(): CollabNoteParts {
		return { frontmatter: this.frontmatter.toString(), body: this.body.toString() }
	}

	applyParts(parts: CollabNoteParts, origin: unknown): boolean {
		let changed = false
		this.doc.transact(() => {
			changed = applyTextDiff(this.frontmatter, parts.frontmatter, origin) || changed
			changed = applyTextDiff(this.body, parts.body, origin) || changed
		}, origin)
		return changed
	}

	seed(parts: CollabNoteParts): void {
		const scratch = new Y.Doc()
		scratch.clientID = hashString32(`${parts.frontmatter}\u0000${parts.body}`)
		scratch.getText("frontmatter").insert(0, parts.frontmatter)
		scratch.getText("body").insert(0, parts.body)
		Y.applyUpdate(this.doc, Y.encodeStateAsUpdate(scratch), SEED_ORIGIN)
		scratch.destroy()
	}

	isEmpty(): boolean {
		return this.doc.store.clients.size === 0
	}

	isLocalEditorTransaction(transaction: Y.Transaction): boolean {
		return transaction.local && this.undoManager.trackedOrigins.has(transaction.origin)
	}

	destroy(): void {
		this.undoManager.destroy()
		this.awareness.destroy()
		this.doc.destroy()
	}
}
