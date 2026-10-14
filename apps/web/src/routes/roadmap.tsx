import { createFileRoute } from "@tanstack/react-router"
import { roadmapCopy } from "../content/roadmap"
import { RoadmapPage } from "../features/roadmap/RoadmapPage"
import { createSeoHead, pageTitle } from "../seo/metadata"
import { getRoadmapItems } from "../server/functions"

export const Route = createFileRoute("/roadmap")({
	loader: async () => ({ roadmap: await getRoadmapItems() }),
	headers: () => ({
		"Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
	}),
	head: () =>
		createSeoHead({
			title: pageTitle("Roadmap"),
			description: roadmapCopy.description,
			path: "/roadmap",
		}),
	component: RoadmapRoute,
})

function RoadmapRoute() {
	const { roadmap } = Route.useLoaderData()

	return <RoadmapPage roadmap={roadmap} />
}
