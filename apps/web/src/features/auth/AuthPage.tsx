import { Alert, AlertDescription, AlertTitle } from "@cortex/ui/alert"
import { Button } from "@cortex/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cortex/ui/card"
import { Input } from "@cortex/ui/input"
import {
	AlertCircle,
	ArrowRight,
	Eye,
	EyeOff,
	Loader2,
	LockKeyhole,
	Server,
	ShieldCheck,
} from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react"
import {
	type AuthActionResult,
	type LoginInput,
	login,
	type SignupInput,
	sanitizeRedirectPath,
	signup,
} from "../../server/auth"
import { ThemeToggle } from "../site/ThemeToggle"

type AuthMode = "login" | "signup"

type LoginSubmitter = (options: { data: LoginInput }) => Promise<AuthActionResult>
type SignupSubmitter = (options: { data: SignupInput }) => Promise<AuthActionResult>

interface AuthPageProps {
	loginAction?: LoginSubmitter
	mode: AuthMode
	redirectTo?: (url: string) => void
	signupAction?: SignupSubmitter
}

interface FormValues {
	displayName: string
	email: string
	password: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

function defaultRedirectTo(url: string) {
	window.location.assign(url)
}

function getRedirectFromLocation() {
	if (typeof window === "undefined") return "/account"
	return sanitizeRedirectPath(new URLSearchParams(window.location.search).get("redirect"))
}

function getOppositeAuthHref(mode: AuthMode, redirectTo: string) {
	const targetPath = mode === "login" ? "/signup" : "/login"
	return `${targetPath}?redirect=${encodeURIComponent(redirectTo)}`
}

function validateForm(mode: AuthMode, values: FormValues) {
	const errors: FormErrors = {}
	const email = values.email.trim()

	if (mode === "signup" && !values.displayName.trim()) {
		errors.displayName = "Enter your name."
	}

	if (!email || !email.includes("@")) {
		errors.email = "Enter a valid email address."
	}

	if (mode === "signup" && values.password.length < 8) {
		errors.password = "Use at least 8 characters."
	}

	if (mode === "login" && !values.password) {
		errors.password = "Enter your password."
	}

	return errors
}

function AuthField({
	children,
	description,
	error,
	id,
	label,
}: {
	children: ReactNode
	description?: string
	error?: string
	id: string
	label: string
}) {
	return (
		<div className="grid gap-2" data-invalid={Boolean(error)}>
			<label className="w-fit text-[13px] leading-5 font-medium text-text-primary" htmlFor={id}>
				{label}
			</label>
			<div className="grid gap-1.5">
				{children}
				{description ? (
					<p id={`${id}-description`} className="m-0 text-[12px] leading-5 text-text-muted">
						{description}
					</p>
				) : null}
				{error ? (
					<p
						id={`${id}-error`}
						className="m-0 text-[12px] leading-5 text-status-error"
						role="alert"
					>
						{error}
					</p>
				) : null}
			</div>
		</div>
	)
}

export function AuthPage({
	loginAction = (options) => login(options),
	mode,
	redirectTo = defaultRedirectTo,
	signupAction = (options) => signup(options),
}: AuthPageProps) {
	const [values, setValues] = useState<FormValues>({
		displayName: "",
		email: "",
		password: "",
	})
	const [errors, setErrors] = useState<FormErrors>({})
	const [formError, setFormError] = useState<string | null>(null)
	const [isPasswordVisible, setIsPasswordVisible] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isSubmittingRef = useRef(false)
	const redirectPath = useMemo(getRedirectFromLocation, [])
	const isSignup = mode === "signup"
	const title = isSignup ? "Create your Cortex account" : "Sign in to Cortex"
	const alternateText = isSignup ? "Already have an account?" : "Don't have an account?"
	const alternateLabel = isSignup ? "Sign in" : "Create account"

	function updateValue(key: keyof FormValues, value: string) {
		setValues((currentValues) => ({ ...currentValues, [key]: value }))
		setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
		setFormError(null)
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (isSubmittingRef.current) return

		const validationErrors = validateForm(mode, values)

		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors)
			return
		}

		isSubmittingRef.current = true
		setIsSubmitting(true)

		void (async () => {
			const result = isSignup
				? await signupAction({
						data: {
							displayName: values.displayName.trim(),
							email: values.email.trim(),
							password: values.password,
							redirectTo: redirectPath,
						},
					})
				: await loginAction({
						data: {
							email: values.email.trim(),
							password: values.password,
							redirectTo: redirectPath,
						},
					})

			if (!result.ok) {
				setFormError(result.message)
				isSubmittingRef.current = false
				setIsSubmitting(false)
				return
			}

			redirectTo(result.redirectTo)
		})().catch(() => {
			setFormError("Cortex Sync is temporarily unavailable. Try again.")
			isSubmittingRef.current = false
			setIsSubmitting(false)
		})
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="fixed inset-x-0 top-3 z-50 px-3 max-sm:top-2">
				<div className="mx-auto flex h-14 w-[min(920px,calc(100%_-_24px))] items-center justify-between rounded-xl px-3 backdrop-blur-xl [background:var(--site-header-glass)] [box-shadow:var(--site-header-shadow)] max-sm:h-[52px] max-sm:w-full">
					<a
						className="inline-flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 py-1 text-[16px] font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
						href="/"
						aria-label="Cortex home"
					>
						<img className="block rounded-lg" src="/icon-192.png" width={30} height={30} alt="" />
						<span>Cortex</span>
					</a>
					<div className="flex items-center gap-1.5">
						<a
							className="hidden min-h-10 items-center rounded-lg px-3 py-2 text-[13px] font-medium text-text-secondary transition-[background-color,color] duration-150 ease-out hover:bg-bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none sm:inline-flex"
							href={getOppositeAuthHref(mode, redirectPath)}
						>
							{alternateLabel}
						</a>
						<ThemeToggle />
					</div>
				</div>
			</header>

			<main id="main-content" tabIndex={-1}>
				<section className="mx-auto grid min-h-screen w-[min(1040px,calc(100%_-_48px))] grid-cols-[minmax(0,0.95fr)_minmax(300px,0.78fr)] items-center gap-12 pt-28 pb-20 max-lg:w-[min(720px,calc(100%_-_40px))] max-lg:grid-cols-1 max-lg:pt-32 max-sm:w-[min(100%_-_28px,520px)]">
					<div className="max-w-[560px]">
						<p className="m-0 text-[15px] leading-6 font-medium text-text-muted">Cortex account</p>
						<h1 className="mt-4 mb-0 text-balance text-[clamp(38px,5vw,64px)] leading-[1.03] font-semibold tracking-[-0.025em] text-text-primary">
							{title}
						</h1>
						<p className="mt-5 mb-0 max-w-[500px] text-pretty text-[16px] leading-7 text-text-secondary">
							Use your Cortex account for hosted Sync checkout. Your Markdown vault still lives on
							your device, and self-hosting remains available.
						</p>

						<div className="mt-9 grid gap-3 text-[14px] leading-6 text-text-secondary">
							<div className="flex items-start gap-3">
								<ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-sage-text" />
								<span>Hosted Sync with client-side encryption before upload.</span>
							</div>
							<div className="flex items-start gap-3">
								<Server className="mt-0.5 size-4 shrink-0 text-accent-sky-text" />
								<span>Encrypted blob storage lives on the Sync backend, not in the web app.</span>
							</div>
							<div className="flex items-start gap-3">
								<LockKeyhole className="mt-0.5 size-4 shrink-0 text-accent-amber-text" />
								<span>Tokens stay in HttpOnly cookies and never go to localStorage.</span>
							</div>
						</div>
					</div>

					<Card className="rounded-xl bg-bg-elevated/95 py-6 shadow-[0_0_0_1px_var(--border-subtle),0_18px_48px_rgba(17,19,26,0.08)] backdrop-blur-xl">
						<CardHeader className="px-6">
							<CardTitle className="text-[24px] leading-8">
								{isSignup ? "Sign up" : "Login"}
							</CardTitle>
							<CardDescription className="text-[14px] leading-6">
								{isSignup
									? "Create an account, then Cortex will sign you in automatically."
									: "Continue to your account or hosted Sync checkout."}
							</CardDescription>
						</CardHeader>
						<CardContent className="px-6">
							<form
								className="grid gap-6"
								onSubmit={handleSubmit}
								noValidate
								aria-busy={isSubmitting}
							>
								{formError ? (
									<Alert variant="destructive" role="alert">
										<AlertCircle className="size-4" aria-hidden="true" />
										<AlertTitle>Could not continue</AlertTitle>
										<AlertDescription>{formError}</AlertDescription>
									</Alert>
								) : null}

								<div className="grid gap-5">
									{isSignup ? (
										<AuthField
											id="display-name"
											label="Name"
											error={errors.displayName}
											description="Shown on your Cortex account."
										>
											<Input
												id="display-name"
												name="displayName"
												autoComplete="name"
												value={values.displayName}
												onChange={(event) => updateValue("displayName", event.target.value)}
												aria-invalid={Boolean(errors.displayName)}
												aria-describedby={
													errors.displayName ? "display-name-error" : "display-name-description"
												}
												disabled={isSubmitting}
												required
											/>
										</AuthField>
									) : null}

									<AuthField id="email" label="Email" error={errors.email}>
										<Input
											id="email"
											name="email"
											type="email"
											inputMode="email"
											autoComplete="email"
											value={values.email}
											onChange={(event) => updateValue("email", event.target.value)}
											aria-invalid={Boolean(errors.email)}
											aria-describedby={errors.email ? "email-error" : undefined}
											disabled={isSubmitting}
											required
										/>
									</AuthField>

									<AuthField id="password" label="Password" error={errors.password}>
										<div className="relative">
											<Input
												id="password"
												name="password"
												type={isPasswordVisible ? "text" : "password"}
												autoComplete={isSignup ? "new-password" : "current-password"}
												className="pr-12"
												value={values.password}
												onChange={(event) => updateValue("password", event.target.value)}
												aria-invalid={Boolean(errors.password)}
												aria-describedby={errors.password ? "password-error" : undefined}
												disabled={isSubmitting}
												required
											/>
											<button
												className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-md text-text-muted transition-[background-color,color,scale] duration-150 ease-out hover:bg-bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.96]"
												type="button"
												aria-label={isPasswordVisible ? "Hide password" : "Show password"}
												disabled={isSubmitting}
												onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
											>
												{isPasswordVisible ? (
													<EyeOff className="size-4" aria-hidden="true" />
												) : (
													<Eye className="size-4" aria-hidden="true" />
												)}
											</button>
										</div>
									</AuthField>
								</div>

								<Button
									className="h-11 w-full tracking-normal"
									type="submit"
									disabled={isSubmitting}
								>
									{isSubmitting ? (
										<>
											<Loader2 className="size-4 animate-spin" aria-hidden="true" />
											{isSignup ? "Creating account" : "Signing in"}
										</>
									) : (
										<>
											{isSignup ? "Create account" : "Sign in"}
											<ArrowRight className="size-4" aria-hidden="true" />
										</>
									)}
								</Button>
							</form>

							<p className="mt-6 text-center text-[13px] leading-5 text-text-secondary">
								{alternateText}{" "}
								<a
									className="font-semibold text-text-primary underline underline-offset-4"
									href={getOppositeAuthHref(mode, redirectPath)}
								>
									{alternateLabel}
								</a>
							</p>
							<p className="mt-5 text-center text-[12px] leading-5 text-text-muted">
								Self-hosted Sync does not require the hosted plan.
							</p>
						</CardContent>
					</Card>
				</section>
			</main>
		</div>
	)
}
