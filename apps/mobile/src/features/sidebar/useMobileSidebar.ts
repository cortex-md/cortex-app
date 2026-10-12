import { createContext, use } from "react"

export interface MobileSidebarContextValue {
	closeSidebar: () => void
	openSidebar: () => void
}

export const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null)

export function useMobileSidebar(): MobileSidebarContextValue {
	const context = use(MobileSidebarContext)
	if (!context) {
		throw new Error("useMobileSidebar must be used inside SidebarProvider")
	}

	return context
}
