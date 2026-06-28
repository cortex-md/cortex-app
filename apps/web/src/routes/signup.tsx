import { createFileRoute, redirect } from "@tanstack/react-router"
import { siteConfig } from "../config/site"
import { AuthPage } from "../features/auth/AuthPage"
import { createSeoHead, noIndexRobots } from "../seo/metadata"
import { getSession, sanitizeRedirectPath } from "../server/auth"

function getRedirectTarget(href: string) {
	return sanitizeRedirectPath(new URL(href, "https://cortex.local").searchParams.get("redirect"))
}

export const Route = createFileRoute("/signup")({
	beforeLoad: async ({ location }) => {
		const session = await getSession()

		if (session.authenticated) {
			throw redirect({ href: getRedirectTarget(location.href) })
		}
	},
	head: () =>
		createSeoHead({
			title: `Sign up — ${siteConfig.name}`,
			description: "Create a Cortex account for hosted Sync checkout and account access.",
			path: "/signup",
			robots: noIndexRobots,
		}),
	component: SignupRoute,
})

function SignupRoute() {
	return <AuthPage mode="signup" />
}
