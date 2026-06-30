import type { Root } from "react-dom/client"

export function createDeferredRootUnmount(root: Root): () => void {
	let disposed = false

	return () => {
		if (disposed) return
		disposed = true
		window.setTimeout(() => {
			root.unmount()
		}, 0)
	}
}
