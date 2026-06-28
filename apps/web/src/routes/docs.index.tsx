import { createFileRoute, redirect } from "@tanstack/react-router"
import { defaultDoc } from "../features/docs/registry"

export const Route = createFileRoute("/docs/")({
	beforeLoad: () => {
		throw redirect({
			to: "/docs/$",
			params: { _splat: defaultDoc.slug },
		})
	},
})
