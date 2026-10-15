import { useEffect, useState } from "react"

export const revealClass =
	"supports-[animation-timeline:view()]:animate-reveal supports-[animation-timeline:view()]:[animation-timeline:view()] supports-[animation-timeline:view()]:[animation-range:entry_0%_cover_28%] motion-reduce:animate-none"

export function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return
		const query = window.matchMedia("(prefers-reduced-motion: reduce)")
		setPrefersReducedMotion(query.matches)
		const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
		query.addEventListener("change", handleChange)
		return () => query.removeEventListener("change", handleChange)
	}, [])

	return prefersReducedMotion
}

export function useMotionPause() {
	const prefersReducedMotion = usePrefersReducedMotion()
	const [userPaused, setUserPaused] = useState(false)
	const isPaused = userPaused || prefersReducedMotion

	return {
		isPaused,
		prefersReducedMotion,
		togglePaused: () => setUserPaused((paused) => !paused),
		pausedAttribute: { "data-motion-paused": isPaused ? "true" : undefined },
	}
}
