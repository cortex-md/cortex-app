import { useCallback, useEffect, useRef, useState } from "react"

export function useCopyFeedback(durationMs = 1200): [boolean, () => void] {
	const [active, setActive] = useState(false)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (timerRef.current !== null) clearTimeout(timerRef.current)
		},
		[],
	)

	const trigger = useCallback(() => {
		setActive(true)
		if (timerRef.current !== null) clearTimeout(timerRef.current)
		timerRef.current = setTimeout(() => setActive(false), durationMs)
	}, [durationMs])

	return [active, trigger]
}
