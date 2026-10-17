import { createFileRoute, redirect } from "@tanstack/react-router"
import { authCopy } from "../content/auth"
import { AuthPage } from "../features/auth/AuthPage"
import { createPrivateSeoHead, pageTitle } from "../seo/metadata"
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
		createPrivateSeoHead({
			title: pageTitle(authCopy.login.seoTitle),
			description: authCopy.login.seoDescription,
			path: "/login",
		}),
	component: LoginRoute,
})

function LoginRoute() {
	return <AuthPage mode="login" />
}
