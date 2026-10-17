import { Button } from "@cortex/ui/button"
import { Spinner } from "@cortex/ui/spinner"
import { ArrowUpRight, LogIn, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { billingCopy } from "../../content/callback"
import { trackEvent } from "../../lib/analytics"
import {
	type BillingCheckoutContext,
	createBillingCheckout,
	readBillingContextFromHash,
} from "../../lib/billingCheckout"
import { type CheckoutSessionResult, startBillingFromSession } from "../../server/billing"
import { CallbackCard, CallbackText } from "../callback/CallbackCard"

type BillingStatus =
	| { state: "checking" }
	| { state: "authenticating" }
	| { state: "account" }
	| { state: "creating" }
	| { state: "redirecting"; checkoutUrl: string }
	| { state: "error"; message: string }

interface BillingPageProps {
	createSessionCheckout?: () => Promise<CheckoutSessionResult>
	fetcher?: typeof fetch
	redirectTo?: (url: string) => void
}

let sharedSessionCheckoutPromise: Promise<CheckoutSessionResult> | null = null
let sharedDesktopCheckoutPromise: Promise<string> | null = null

function defaultRedirectTo(url: string) {
	window.location.assign(url)
}

function defaultCreateSessionCheckout() {
	return startBillingFromSession()
}

function scrubBillingFragment() {
	window.history.replaceState(
		window.history.state,
		"",
		`${window.location.pathname}${window.location.search}`,
	)
}

function CheckoutStatus({
	checkoutUrl,
	message,
	onRetry,
	status,
}: {
	checkoutUrl?: string
	message?: string
	onRetry: () => void
	status: BillingStatus["state"]
}) {
	if (status === "authenticating" || status === "account") {
		const copy = status === "authenticating" ? billingCopy.authenticating : billingCopy.account
		return (
			<CallbackCard icon={<LogIn />} title={copy.title}>
				<CallbackText>{copy.body}</CallbackText>
			</CallbackCard>
		)
	}

	if (status === "redirecting" && checkoutUrl) {
		return (
			<CallbackCard
				icon={<ArrowUpRight />}
				tone="ok"
				title={billingCopy.redirecting.title}
				actions={
					<Button size="lg" asChild>
						<a href={checkoutUrl}>
							{billingCopy.redirecting.cta}
							<ArrowUpRight aria-hidden="true" />
						</a>
					</Button>
				}
			>
				<CallbackText>{billingCopy.redirecting.body}</CallbackText>
			</CallbackCard>
		)
	}

	if (status === "error") {
		return (
			<CallbackCard
				icon={<RefreshCw />}
				tone="warn"
				title={billingCopy.error.title}
				actions={
					<Button size="lg" type="button" onClick={onRetry}>
						{billingCopy.error.cta}
						<RefreshCw aria-hidden="true" />
					</Button>
				}
			>
				<CallbackText role="alert">{message ?? billingCopy.error.fallback}</CallbackText>
			</CallbackCard>
		)
	}

	return (
		<CallbackCard icon={<Spinner className="size-6" />} title={billingCopy.checking.title}>
			<CallbackText>{billingCopy.checking.body}</CallbackText>
		</CallbackCard>
	)
}

export function BillingPage({
	createSessionCheckout = defaultCreateSessionCheckout,
	fetcher = globalThis.fetch,
	redirectTo = defaultRedirectTo,
}: BillingPageProps) {
	const [billingContext, setBillingContext] = useState<BillingCheckoutContext | null>(null)
	const [status, setStatus] = useState<BillingStatus>({ state: "checking" })
	const hasStartedInitialCheckoutRef = useRef(false)
	const isCheckoutInFlightRef = useRef(false)

	const startDesktopCheckout = useCallback(
		async (context: BillingCheckoutContext) => {
			if (isCheckoutInFlightRef.current) return
			isCheckoutInFlightRef.current = true
			setStatus({ state: "creating" })

			try {
				if (!sharedDesktopCheckoutPromise) {
					sharedDesktopCheckoutPromise = createBillingCheckout(context, fetcher).finally(() => {
						sharedDesktopCheckoutPromise = null
					})
				}

				const checkoutUrl = await sharedDesktopCheckoutPromise
				setStatus({ state: "redirecting", checkoutUrl })
				redirectTo(checkoutUrl)
			} catch (error) {
				isCheckoutInFlightRef.current = false
				setStatus({
					state: "error",
					message:
						error instanceof Error
							? error.message
							: "Cortex Sync could not create a checkout. Please try again from the app.",
				})
			}
		},
		[fetcher, redirectTo],
	)

	const startSessionCheckout = useCallback(async () => {
		if (isCheckoutInFlightRef.current) return
		isCheckoutInFlightRef.current = true
		setStatus({ state: "creating" })

		try {
			let result: CheckoutSessionResult

			if (createSessionCheckout === defaultCreateSessionCheckout) {
				if (!sharedSessionCheckoutPromise) {
					sharedSessionCheckoutPromise = createSessionCheckout().finally(() => {
						sharedSessionCheckoutPromise = null
					})
				}

				result = await sharedSessionCheckoutPromise
			} else {
				result = await createSessionCheckout()
			}

			if (result.ok) {
				if ("redirectTo" in result) {
					setStatus({ state: "account" })
					redirectTo(result.redirectTo)
					return
				}

				setStatus({ state: "redirecting", checkoutUrl: result.checkoutUrl })
				redirectTo(result.checkoutUrl)
				return
			}

			if (result.code === "unauthenticated") {
				setStatus({ state: "authenticating" })
				redirectTo(result.redirectTo)
				return
			}

			isCheckoutInFlightRef.current = false
			setStatus({ state: "error", message: result.message })
		} catch {
			isCheckoutInFlightRef.current = false
			setStatus({
				state: "error",
				message: "Cortex Sync could not create a checkout. Try again in a moment.",
			})
		}
	}, [createSessionCheckout, redirectTo])

	useEffect(() => {
		if (hasStartedInitialCheckoutRef.current) return
		hasStartedInitialCheckoutRef.current = true

		const context = readBillingContextFromHash(window.location.hash)
		if (window.location.hash) scrubBillingFragment()

		if (context) {
			setBillingContext(context)
			void startDesktopCheckout(context)
			return
		}

		setBillingContext(null)
		void startSessionCheckout()
	}, [startDesktopCheckout, startSessionCheckout])

	const handleRetry = useCallback(() => {
		trackEvent({ name: "checkout_started", location: "billing" })

		if (billingContext) {
			void startDesktopCheckout(billingContext)
			return
		}

		void startSessionCheckout()
	}, [billingContext, startDesktopCheckout, startSessionCheckout])

	return (
		<CheckoutStatus
			checkoutUrl={status.state === "redirecting" ? status.checkoutUrl : undefined}
			message={status.state === "error" ? status.message : undefined}
			onRetry={handleRetry}
			status={status.state}
		/>
	)
}
