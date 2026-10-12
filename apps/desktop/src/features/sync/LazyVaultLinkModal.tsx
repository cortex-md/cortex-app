import { lazy } from "react"

export const LazyVaultLinkModal = lazy(() =>
	import("./VaultLinkModal").then((module) => ({ default: module.VaultLinkModal })),
)
