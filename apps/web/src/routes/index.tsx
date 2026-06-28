import { createFileRoute } from "@tanstack/react-router"
import { LandingPage } from "../features/landing/LandingPage"
import { createHomeHead } from "../seo/home"
import { getPluginCodeHtml } from "../server/highlight"

export const Route = createFileRoute("/")({
	component: HomeRoute,
	head: createHomeHead,
	loader: async () => ({
		pluginCodeHtml: await getPluginCodeHtml(),
	}),
})

function HomeRoute() {
	const { pluginCodeHtml } = Route.useLoaderData()

	return <LandingPage pluginCodeHtml={pluginCodeHtml} />
}
