import { createFileRoute } from "@tanstack/react-router"
import { LandingPage } from "../features/landing/LandingPage"
import { createHomeHead } from "../seo/home"

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: createHomeHead,
})
