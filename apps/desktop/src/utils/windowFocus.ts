export function onWindowFocus(listener: () => void): () => void {
	window.addEventListener("focus", listener)
	return () => window.removeEventListener("focus", listener)
}
