import katexStylesheetUrl from "katex/dist/katex.min.css?url"

let stylesheetPromise: Promise<void> | null = null

export function ensureMathStylesheet(): Promise<void> {
	if (typeof document === "undefined") return Promise.resolve()
	if (stylesheetPromise) return stylesheetPromise

	stylesheetPromise = new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLLinkElement>("link[data-cortex-math-katex]")
		if (existing) {
			resolve()
			return
		}

		const link = document.createElement("link")
		link.rel = "stylesheet"
		link.href = katexStylesheetUrl
		link.dataset.cortexMathKatex = "true"
		link.addEventListener("load", () => resolve(), { once: true })
		link.addEventListener(
			"error",
			() => {
				stylesheetPromise = null
				reject(new Error("Failed to load KaTeX stylesheet"))
			},
			{ once: true },
		)
		document.head.appendChild(link)
	})

	return stylesheetPromise
}
