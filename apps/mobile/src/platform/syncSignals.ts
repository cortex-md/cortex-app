type LocalChangeListener = (path: string, deleted: boolean) => void

const listeners = new Set<LocalChangeListener>()

export function onLocalFileChange(listener: LocalChangeListener): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function notifyLocalFileChange(path: string, deleted = false): void {
	for (const listener of listeners) listener(path, deleted)
}
