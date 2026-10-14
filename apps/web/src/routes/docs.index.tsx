import { createFileRoute, redirect } from "@tanstack/react-router"
import { getDefaultDocSlug } from "../server/docs"

export const Route = createFileRoute("/docs/")({
	beforeLoad: async () => {
		const slug = await getDefaultDocSlug()
		throw redirect({
			to: "/docs/$",
			params: { _splat: slug ?? "" },
		})
	},
})
