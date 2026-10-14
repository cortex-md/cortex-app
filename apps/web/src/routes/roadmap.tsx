import { createFileRoute } from "@tanstack/react-router"
import { roadmapCopy } from "../content/roadmap"
import { RoadmapPage } from "../features/roadmap/RoadmapPage"
import { createSeoHead, pageTitle } from "../seo/metadata"

export const Route = createFileRoute("/roadmap")({
	head: () =>
		createSeoHead({
			title: pageTitle("Roadmap"),
			description: roadmapCopy.description,
			path: "/roadmap",
		}),
	component: RoadmapPage,
})
