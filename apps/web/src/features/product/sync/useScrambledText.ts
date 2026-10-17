import { type RefObject, useEffect, useState } from "react"
import { usePrefersReducedMotion } from "../../site/motion"

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

function scramble(step: number, length: number) {
	let seed = step * 7919 + 17
	let output = ""
	for (let index = 0; index < length; index++) {
		seed = (seed * 16807) % 2147483647
		output += alphabet[Math.floor((seed / 2147483647) * alphabet.length)]
	}
	return output
}

export function useScrambledText(target: RefObject<HTMLElement | null>, length = 64) {
	const prefersReducedMotion = usePrefersReducedMotion()
	const [step, setStep] = useState(0)

	useEffect(() => {
		const element = target.current
		if (prefersReducedMotion || !element || typeof IntersectionObserver === "undefined") return

		let timer: number | undefined
		const observer = new IntersectionObserver(([entry]) => {
			window.clearInterval(timer)
			timer = undefined
			if (entry?.isIntersecting) {
				timer = window.setInterval(() => setStep((current) => current + 1), 160)
			}
		})
		observer.observe(element)

		return () => {
			observer.disconnect()
			window.clearInterval(timer)
		}
	}, [prefersReducedMotion, target])

	return scramble(step, length)
}
