import { createFileRoute, redirect } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { AuthPage } from "../features/auth/AuthPage"
import { createSeoHead, noIndexRobots } from "../seo/metadata"
import { getSession, sanitizeRedirectPath } from "../server/auth"

function getRedirectTarget(href: string) {
	return sanitizeRedirectPath(new URL(href, "https://cortex.local").searchParams.get("redirect"))
}

export const Route = createFileRoute("/login")({
	beforeLoad: async ({ location }) => {
		const session = await getSession()

		if (session.authenticated) {
			throw redirect({ href: getRedirectTarget(location.href) })
		}
	},
	head: () =>
		createSeoHead({
			title: `Login — ${siteConfig.name}`,
			description: "Sign in to Cortex for hosted Sync checkout and account access.",
			path: "/login",
			robots: noIndexRobots,
		}),
	component: LoginRoute,
})

function LoginRoute() {
	return <AuthPage mode="login" />
}
