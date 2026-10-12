import { useEffect, useEffectEvent, useMemo, useRef } from "react"

export interface DebouncedCallback<Args extends unknown[]> {
	(...args: Args): void
	cancel: () => void
	flush: () => void
}

export function useDebouncedCallback<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delayMs: number,
): DebouncedCallback<Args> {
	const invoke = useEffectEvent(callback)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingArgsRef = useRef<Args | null>(null)

	const debounced = useMemo(() => {
		const cancel = () => {
			if (timerRef.current !== null) clearTimeout(timerRef.current)
			timerRef.current = null
			pendingArgsRef.current = null
		}
		const flush = () => {
			const args = pendingArgsRef.current
			cancel()
			if (args) invoke(...args)
		}
		const run = (...args: Args) => {
			if (timerRef.current !== null) clearTimeout(timerRef.current)
			pendingArgsRef.current = args
			timerRef.current = setTimeout(flush, delayMs)
		}
		return Object.assign(run, { cancel, flush })
	}, [delayMs])

	useEffect(() => debounced.cancel, [debounced])

	return debounced
}
