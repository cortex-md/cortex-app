import { Button } from "@cortex/ui/button"
import { ArrowUpRight, Loader2, LogIn, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { trackLandingEvent } from "../../lib/analytics"
import {
	type BillingCheckoutContext,
	createBillingCheckout,
	readBillingContextFromHash,
} from "../../lib/billingCheckout"
import { type CheckoutSessionResult, startBillingFromSession } from "../../server/billing"

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
	if (
		status === "checking" ||
		status === "creating" ||
		status === "authenticating" ||
		status === "account"
	) {
		const isAuthenticating = status === "authenticating"
		const isAccountRedirect = status === "account"
		return (
			<div className="mx-auto grid max-w-[360px] justify-items-center text-center">
				<span
					className="grid size-11 place-items-center rounded-lg bg-bg-elevated text-text-secondary shadow-[0_0_0_1px_var(--border-subtle)]"
					aria-hidden="true"
				>
					{isAuthenticating || isAccountRedirect ? (
						<LogIn className="size-5" />
					) : (
						<Loader2 className="size-5 animate-spin" />
					)}
				</span>
				<div className="mt-5">
					<h1 className="m-0 text-[20px] leading-7 font-semibold text-text-primary">
						{isAuthenticating
							? "Taking you to sign in"
							: isAccountRedirect
								? "Opening your account"
								: "Opening checkout"}
					</h1>
					<p className="mt-2 text-[14px] leading-6 text-text-secondary">
						{isAuthenticating
							? "Sign in or create an account, then Cortex will continue to checkout."
							: isAccountRedirect
								? "Your hosted Sync plan is already active."
								: "Cortex is creating your AbacatePay checkout."}
					</p>
				</div>
			</div>
		)
	}

	if (status === "redirecting" && checkoutUrl) {
		return (
			<div className="mx-auto grid max-w-[360px] justify-items-center text-center">
				<span
					className="grid size-11 place-items-center rounded-lg bg-accent-sage-subtle text-accent-sage-text"
					aria-hidden="true"
				>
					<ArrowUpRight className="size-5" />
				</span>
				<h1 className="mt-5 mb-0 text-[20px] leading-7 font-semibold text-text-primary">
					Redirecting to checkout
				</h1>
				<p className="mt-2 text-[14px] leading-6 text-text-secondary">
					If the checkout does not open automatically, continue manually.
				</p>
				<Button className="mt-5" asChild>
					<a href={checkoutUrl}>
						Continue to AbacatePay
						<ArrowUpRight className="size-4" aria-hidden="true" />
					</a>
				</Button>
			</div>
		)
	}

	if (status === "error") {
		return (
			<div className="mx-auto grid max-w-[420px] justify-items-center rounded-xl bg-bg-elevated p-6 text-center shadow-[0_0_0_1px_var(--border-subtle)]">
				<span
					className="grid size-11 place-items-center rounded-lg bg-accent-coral-subtle text-accent-coral-text"
					aria-hidden="true"
				>
					<RefreshCw className="size-5" />
				</span>
				<h1 className="mt-5 mb-0 text-[20px] leading-7 font-semibold text-text-primary">
					Checkout is temporarily unavailable
				</h1>
				<p className="mt-2 text-[14px] leading-6 text-text-secondary" role="alert">
					{message}
				</p>
				<Button className="mt-5" type="button" onClick={onRetry}>
					Try again
					<RefreshCw className="size-4" aria-hidden="true" />
				</Button>
			</div>
		)
	}

	return null
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
		trackLandingEvent({ name: "pricing_checkout_clicked", location: "billing" })

		if (billingContext) {
			void startDesktopCheckout(billingContext)
			return
		}

		void startSessionCheckout()
	}, [billingContext, startDesktopCheckout, startSessionCheckout])

	return (
		<div className="min-h-screen bg-background text-foreground">
			<main
				id="main-content"
				className="grid min-h-screen place-items-center px-6 py-16"
				tabIndex={-1}
			>
				<CheckoutStatus
					checkoutUrl={status.state === "redirecting" ? status.checkoutUrl : undefined}
					message={status.state === "error" ? status.message : undefined}
					onRetry={handleRetry}
					status={status.state}
				/>
			</main>
		</div>
	)
}
