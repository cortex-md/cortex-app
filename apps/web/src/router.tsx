import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { NotFoundPage } from "./features/site/NotFoundPage"
import { RouteErrorPage } from "./features/site/RouteErrorPage"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 30_000,
		defaultStaleTime: 30_000,
		defaultErrorComponent: RouteErrorPage,
		defaultNotFoundComponent: NotFoundPage,
	})

	return router
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>
	}
}
