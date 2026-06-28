import * as React from "react"

const MOBILE_BREAKPOINT = 768

function getMobileSnapshot(): boolean {
	if (typeof window === "undefined") return false
	return window.innerWidth < MOBILE_BREAKPOINT
}

function subscribeToMobileSnapshot(onStoreChange: () => void): () => void {
	if (typeof window === "undefined") return () => {}
	if (!window.matchMedia) {
		window.addEventListener("resize", onStoreChange)
		return () => window.removeEventListener("resize", onStoreChange)
	}
	const mediaQueryList = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
	mediaQueryList.addEventListener("change", onStoreChange)
	return () => mediaQueryList.removeEventListener("change", onStoreChange)
}

export function useIsMobile() {
	return React.useSyncExternalStore(subscribeToMobileSnapshot, getMobileSnapshot, () => false)
}
