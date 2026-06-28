import { useCallback, useEffect, useRef } from "react"

export function usePropertyDraftCommit(commit: () => Promise<boolean>, onClose: () => void) {
	const commitRef = useRef(commit)
	const pendingRef = useRef<Promise<boolean> | null>(null)
	const cancelledRef = useRef(false)
	const committedRef = useRef(false)

	useEffect(() => {
		commitRef.current = commit
	})

	const commitOnce = useCallback(() => {
		if (cancelledRef.current || committedRef.current) return Promise.resolve(true)
		if (pendingRef.current) return pendingRef.current
		pendingRef.current = commitRef
			.current()
			.then((valid) => {
				if (valid) committedRef.current = true
				return valid
			})
			.finally(() => {
				pendingRef.current = null
			})
		return pendingRef.current
	}, [])

	const commitAndClose = useCallback(async () => {
		if (await commitOnce()) onClose()
	}, [commitOnce, onClose])

	const cancel = useCallback(() => {
		cancelledRef.current = true
		onClose()
	}, [onClose])

	return { cancel, commitAndClose, commitOnce }
}
