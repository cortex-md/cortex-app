import { Button } from "@cortex/ui/button"
import { Spinner } from "@cortex/ui/spinner"
import { useRouter } from "@tanstack/react-router"
import { Check, Clock, Mail, RefreshCw, Undo2, Vault } from "lucide-react"
import { useState } from "react"
import { getInviteDeepLink } from "../../config/deepLinks"
import { inviteCopy } from "../../content/callback"
import { trackEvent } from "../../lib/analytics"
import { logout } from "../../server/auth"
import {
	type AcceptInviteResult,
	acceptInvite,
	getInviteLoginPath,
	type InvitePreviewResult,
} from "../../server/invite"
import { formatDate } from "../account/accountFormat"
import { CallbackCard, CallbackText } from "../callback/CallbackCard"

type InviteView =
	| { state: "pending" }
	| { state: "accepting" }
	| { state: "accepted"; vaultName: string }
	| { state: "declined" }
	| { state: "expired" }
	| { state: "error"; message: string }

type AcceptAction = (options: { data: { token: string } }) => Promise<AcceptInviteResult>

interface InvitePageProps {
	token: string
	preview: Exclude<InvitePreviewResult, { status: "unauthenticated" }>
	acceptAction?: AcceptAction
	redirectTo?: (url: string) => void
}

function defaultRedirectTo(url: string) {
	window.location.assign(url)
}

function initialView(preview: InvitePageProps["preview"]): InviteView {
	if (preview.status === "expired") return { state: "expired" }
	if (preview.status === "unavailable") return { state: "error", message: preview.message }
	return { state: "pending" }
}

export function InvitePage({
	token,
	preview,
	acceptAction = (options) => acceptInvite(options),
	redirectTo = defaultRedirectTo,
}: InvitePageProps) {
	const router = useRouter()
	const [view, setView] = useState<InviteView>(() => initialView(preview))

	if (view.state === "expired") {
		return (
			<CallbackCard
				icon={<Clock />}
				tone="warn"
				title={inviteCopy.expiredTitle}
				actions={
					<Button size="lg" variant="secondary" asChild>
						<a href="/account">{inviteCopy.expiredCta}</a>
					</Button>
				}
			>
				<CallbackText>{inviteCopy.expiredBody}</CallbackText>
			</CallbackCard>
		)
	}

	if (view.state === "error") {
		return (
			<CallbackCard
				icon={<RefreshCw />}
				tone="warn"
				title={inviteCopy.unavailableTitle}
				actions={
					<Button
						size="lg"
						variant="secondary"
						type="button"
						onClick={() => void router.invalidate()}
					>
						{inviteCopy.retry}
						<RefreshCw aria-hidden="true" />
					</Button>
				}
			>
				<CallbackText role="alert">{view.message}</CallbackText>
			</CallbackCard>
		)
	}

	if (view.state === "accepted") {
		return (
			<CallbackCard
				icon={<Check />}
				tone="ok"
				title={inviteCopy.acceptedTitle(view.vaultName)}
				actions={
					<>
						<Button size="lg" asChild>
							<a href={getInviteDeepLink(token)}>{inviteCopy.openInCortex}</a>
						</Button>
						<Button size="lg" variant="secondary" asChild>
							<a href={inviteCopy.downloadHref}>{inviteCopy.download}</a>
						</Button>
					</>
				}
			>
				<CallbackText>{inviteCopy.acceptedBody}</CallbackText>
			</CallbackCard>
		)
	}

	if (view.state === "declined") {
		return (
			<CallbackCard
				icon={<Undo2 />}
				tone="warn"
				title={inviteCopy.declinedTitle}
				actions={
					<Button
						size="lg"
						variant="ghost"
						type="button"
						onClick={() => setView({ state: "pending" })}
					>
						{inviteCopy.undo}
					</Button>
				}
			>
				<CallbackText>{inviteCopy.declinedBody}</CallbackText>
			</CallbackCard>
		)
	}

	if (preview.status !== "pending") return null

	const { invite, email } = preview
	const role = inviteCopy.roles[invite.role]
	const expires = formatDate(invite.expiresAt)
	const isAccepting = view.state === "accepting"

	async function handleAccept() {
		setView({ state: "accepting" })
		try {
			const result = await acceptAction({ data: { token } })
			if (result.ok) {
				trackEvent({ name: "invite_accepted" })
				setView({ state: "accepted", vaultName: result.vaultName || invite.vaultName })
				return
			}
			if (result.code === "unauthenticated") {
				redirectTo(result.redirectTo)
				return
			}
			if (result.code === "expired") {
				setView({ state: "expired" })
				return
			}
			setView({ state: "error", message: result.message })
		} catch {
			setView({
				state: "error",
				message: "Cortex Sync couldn’t load this invite. Try again in a moment.",
			})
		}
	}

	async function handleSwitch() {
		try {
			await logout({ data: {} })
		} finally {
			redirectTo(getInviteLoginPath(token))
		}
	}

	return (
		<CallbackCard
			icon={<Mail />}
			title={inviteCopy.pendingTitle(invite.inviterName)}
			actions={
				<>
					<Button
						size="lg"
						type="button"
						onClick={() => void handleAccept()}
						disabled={isAccepting}
					>
						{isAccepting ? <Spinner aria-label={inviteCopy.accepting} /> : null}
						{inviteCopy.accept}
					</Button>
					<Button
						variant="ghost"
						type="button"
						className="max-sm:h-11"
						onClick={() => setView({ state: "declined" })}
						disabled={isAccepting}
					>
						{inviteCopy.decline}
					</Button>
				</>
			}
			fine={
				<>
					{expires ? `${inviteCopy.expires(expires)} ` : null}
					{inviteCopy.signedInAs(email)} ·{" "}
					<button
						type="button"
						className="rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:shadow-focus"
						onClick={() => void handleSwitch()}
					>
						{inviteCopy.switchAccount}
					</button>
				</>
			}
		>
			<div className="mt-5 flex items-center gap-3 rounded-[14px] bg-cell p-3.5 text-left">
				<span
					className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-text-on-accent [&_svg]:size-5"
					aria-hidden="true"
				>
					<Vault />
				</span>
				<div className="min-w-0">
					<b className="block truncate text-[15px] leading-[1.3] font-semibold">
						{invite.vaultName}
					</b>
					<small className="text-[13px] leading-[1.4] text-text-muted">
						{inviteCopy.joinAs(role)}
					</small>
				</div>
			</div>
		</CallbackCard>
	)
}
