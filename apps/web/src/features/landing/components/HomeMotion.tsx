import { createContext, useContext, useEffect, useRef } from "react"

interface HomeMotionValue {
	isPaused: boolean
	togglePaused: () => void
}

export const HomeMotionContext = createContext<HomeMotionValue>({
	isPaused: false,
	togglePaused: () => {},
})

export function useHomeMotion() {
	return useContext(HomeMotionContext)
}

export function useInterval(callback: () => void, delay: number, enabled: boolean, resetKey = 0) {
	const callbackRef = useRef(callback)
	callbackRef.current = callback

	// biome-ignore lint/correctness/useExhaustiveDependencies: resetKey restarts the interval after a manual change.
	useEffect(() => {
		if (!enabled) return
		const id = window.setInterval(() => callbackRef.current(), delay)
		return () => window.clearInterval(id)
	}, [delay, enabled, resetKey])
}
