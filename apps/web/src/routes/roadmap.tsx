import { createFileRoute } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { RoadmapPage } from "../features/roadmap/RoadmapPage"
import { createSeoHead } from "../seo/metadata"

const roadmapDescription = "What is available in Cortex today and what is still being built."

export const Route = createFileRoute("/roadmap")({
	head: () =>
		createSeoHead({
			title: `Roadmap — ${siteConfig.name}`,
			description: roadmapDescription,
			path: "/roadmap",
		}),
	component: RoadmapPage,
})
