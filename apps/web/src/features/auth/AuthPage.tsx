import { Alert, AlertDescription, AlertTitle } from "@cortex/ui/alert"
import { Button } from "@cortex/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@cortex/ui/input-group"
import { cn } from "@cortex/ui/lib/utils"
import { Spinner } from "@cortex/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@cortex/ui/tabs"
import {
	AlertCircle,
	ArrowRight,
	Check,
	Eye,
	EyeOff,
	LockKeyhole,
	Mail,
	ShieldCheck,
	UserRound,
} from "lucide-react"
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react"
import { authCopy } from "../../content/auth"
import {
	createWebAccountIdentity,
	deriveAccountKeys,
	type WebAccountIdentity,
} from "../../lib/accountKeys"
import { trackEvent } from "../../lib/analytics"
import {
	type AuthActionResult,
	type LoginInput,
	login,
	prelogin,
	type SignupInput,
	sanitizeRedirectPath,
	signup,
} from "../../server/auth"

type AuthMode = "login" | "signup"

type LoginSubmitter = (options: { data: LoginInput }) => Promise<AuthActionResult>
type SignupSubmitter = (options: { data: SignupInput }) => Promise<AuthActionResult>

type LoginProof = { ok: true; password: string } | { ok: false; message: string }

export interface AuthCredentials {
	loginPassword(email: string, password: string): Promise<LoginProof>
	signupKeys(password: string): Promise<WebAccountIdentity>
}

const browserCredentials: AuthCredentials = {
	loginPassword: async (email, password) => {
		const result = await prelogin({ data: { email } })
		if (!result.ok) return result
		if (result.kdfVersion < 1) return { ok: true, password }
		if (!result.kdfSalt) return { ok: false, message: "Cortex Sync is temporarily unavailable." }
		return { ok: true, password: (await deriveAccountKeys(password, result.kdfSalt)).authKey }
	},
	signupKeys: createWebAccountIdentity,
}

interface AuthPageProps {
	credentials?: AuthCredentials
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
		errors.displayName = authCopy.errors.name
	}

	if (!email || !email.includes("@")) {
		errors.email = authCopy.errors.email
	}

	if (mode === "signup" && values.password.length < 8) {
		errors.password = authCopy.errors.passwordShort
	}

	if (mode === "login" && !values.password) {
		errors.password = authCopy.errors.passwordMissing
	}

	return errors
}

function getPasswordScore(password: string) {
	return (
		(password.length >= 8 ? 1 : 0) +
		(/[A-Z]/.test(password) && /[a-z]/.test(password) ? 1 : 0) +
		(/\d/.test(password) ? 1 : 0) +
		(/[^A-Za-z0-9]/.test(password) || password.length >= 14 ? 1 : 0)
	)
}

const inputGroupClass =
	"h-11 rounded-xl border-0 bg-input-bg px-0 text-text-muted shadow-[0_0_0_1px_var(--input-border)] has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_1px_var(--border-focus),0_0_0_4px_color-mix(in_srgb,var(--border-focus)_18%,transparent)] has-[[data-slot=input-group-control]:focus-visible]:ring-0"
const inputClass = "text-[15px] text-text-primary placeholder:text-text-muted"

function AuthField({
	children,
	error,
	id,
	label,
	footer,
}: {
	children: ReactNode
	error?: string
	id: string
	label: string
	footer?: ReactNode
}) {
	return (
		<div className="mt-[18px] flex flex-col gap-1.5" data-invalid={Boolean(error)}>
			<label className="w-fit text-[13px] leading-none font-medium text-text-primary" htmlFor={id}>
				{label}
			</label>
			{children}
			{footer}
			{error ? (
				<p
					id={`${id}-error`}
					className="m-0 text-[12px] leading-[1.4] text-status-error-foreground"
					role="alert"
				>
					{error}
				</p>
			) : null}
		</div>
	)
}

export function AuthPage({
	credentials = browserCredentials,
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
	const copy = isSignup ? authCopy.signup : authCopy.login
	const passwordScore = getPasswordScore(values.password)
	const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())

	function updateValue(key: keyof FormValues, value: string) {
		setValues((currentValues) => ({ ...currentValues, [key]: value }))
		setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
		setFormError(null)
	}

	async function submitSignup(email: string): Promise<AuthActionResult> {
		const identity = await credentials.signupKeys(values.password)
		return await signupAction({
			data: {
				displayName: values.displayName.trim(),
				email,
				password: identity.authKey,
				kdfSalt: identity.kdfSalt,
				publicKey: identity.publicKey,
				encryptedPrivateKey: identity.encryptedPrivateKey,
				redirectTo: redirectPath,
			},
		})
	}

	async function submitLogin(email: string): Promise<AuthActionResult> {
		const proof = await credentials.loginPassword(email, values.password)
		if (!proof.ok) return proof
		return await loginAction({
			data: { email, password: proof.password, redirectTo: redirectPath },
		})
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
			const email = values.email.trim()
			const result = isSignup ? await submitSignup(email) : await submitLogin(email)

			if (!result.ok) {
				setFormError(result.message)
				isSubmittingRef.current = false
				setIsSubmitting(false)
				return
			}

			trackEvent({ name: "auth_completed", mode })
			redirectTo(result.redirectTo)
		})().catch(() => {
			setFormError(authCopy.unavailable)
			isSubmittingRef.current = false
			setIsSubmitting(false)
		})
	}

	return (
		<div className="flex justify-center bg-[radial-gradient(50%_40%_at_50%_0%,var(--accent-subtle),transparent_70%)] px-4 pt-[72px] pb-24 max-sm:pt-8 max-sm:pb-16">
			<section
				className="w-[min(420px,100%)] rounded-[22px] bg-bg-elevated p-8 shadow-lift max-sm:p-6"
				aria-labelledby="auth-title"
			>
				<Tabs value={mode}>
					<TabsList className="w-full" aria-label={authCopy.tabsLabel}>
						<TabsTrigger value="login" asChild>
							<a href={getOppositeAuthHref("signup", redirectPath)}>{authCopy.loginTab}</a>
						</TabsTrigger>
						<TabsTrigger value="signup" asChild>
							<a href={getOppositeAuthHref("login", redirectPath)}>{authCopy.signupTab}</a>
						</TabsTrigger>
					</TabsList>
				</Tabs>
				<h1
					id="auth-title"
					className="mt-5 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em]"
				>
					{copy.title}
				</h1>
				<p className="mt-1.5 mb-0 text-[15px] text-text-secondary">{copy.sub}</p>

				<form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
					{formError ? (
						<Alert
							variant="destructive"
							className="mt-5 rounded-xl border-0 bg-status-error-background text-status-error-foreground shadow-none"
						>
							<AlertCircle aria-hidden="true" />
							<AlertTitle>{authCopy.errorTitle}</AlertTitle>
							<AlertDescription className="text-status-error-foreground">
								{formError}
							</AlertDescription>
						</Alert>
					) : null}

					{isSignup ? (
						<AuthField id="display-name" label={authCopy.nameLabel} error={errors.displayName}>
							<InputGroup className={inputGroupClass}>
								<InputGroupAddon>
									<UserRound aria-hidden="true" />
								</InputGroupAddon>
								<InputGroupInput
									id="display-name"
									name="displayName"
									autoComplete="name"
									className={inputClass}
									placeholder={authCopy.namePlaceholder}
									value={values.displayName}
									onChange={(event) => updateValue("displayName", event.target.value)}
									aria-invalid={Boolean(errors.displayName)}
									aria-describedby={errors.displayName ? "display-name-error" : undefined}
									disabled={isSubmitting}
									required
								/>
							</InputGroup>
						</AuthField>
					) : null}

					<AuthField id="email" label={authCopy.emailLabel} error={errors.email}>
						<InputGroup
							className={cn(
								inputGroupClass,
								isEmailValid && "shadow-[0_0_0_1px_var(--status-success)]",
							)}
						>
							<InputGroupAddon>
								<Mail aria-hidden="true" />
							</InputGroupAddon>
							<InputGroupInput
								id="email"
								name="email"
								type="email"
								inputMode="email"
								autoComplete="email"
								className={inputClass}
								placeholder={authCopy.emailPlaceholder}
								value={values.email}
								onChange={(event) => updateValue("email", event.target.value)}
								aria-invalid={Boolean(errors.email)}
								aria-describedby={errors.email ? "email-error" : undefined}
								disabled={isSubmitting}
								required
							/>
							{isEmailValid ? (
								<InputGroupAddon align="inline-end">
									<Check className="text-status-success-foreground" aria-hidden="true" />
								</InputGroupAddon>
							) : null}
						</InputGroup>
					</AuthField>

					<AuthField
						id="password"
						label={authCopy.passwordLabel}
						error={errors.password}
						footer={
							isSignup ? (
								<>
									<span className="mt-0.5 grid grid-cols-4 gap-1" aria-hidden="true">
										{[0, 1, 2, 3].map((index) => (
											<i
												key={index}
												className={cn(
													"h-1 rounded-full transition-colors duration-200 ease-out",
													index < passwordScore ? "bg-status-success" : "bg-sep",
												)}
											/>
										))}
									</span>
									<span
										className={cn(
											"text-[12px] leading-[1.4]",
											values.password.length >= 8 && passwordScore >= 3
												? "text-status-success-foreground"
												: "text-text-muted",
										)}
									>
										{authCopy.passwordHint(values.password.length, passwordScore)}
									</span>
								</>
							) : null
						}
					>
						<InputGroup className={inputGroupClass}>
							<InputGroupAddon>
								<LockKeyhole aria-hidden="true" />
							</InputGroupAddon>
							<InputGroupInput
								id="password"
								name="password"
								type={isPasswordVisible ? "text" : "password"}
								autoComplete={isSignup ? "new-password" : "current-password"}
								className={inputClass}
								placeholder={copy.passwordPlaceholder}
								value={values.password}
								onChange={(event) => updateValue("password", event.target.value)}
								aria-invalid={Boolean(errors.password)}
								aria-describedby={errors.password ? "password-error" : undefined}
								disabled={isSubmitting}
								required
							/>
							<InputGroupAddon align="inline-end" className="pr-0.5">
								<button
									className="grid size-10 place-items-center rounded-[10px] text-text-muted outline-none transition-[background-color,color] duration-150 ease-out hover:bg-fill-quiet hover:text-text-primary focus-visible:shadow-focus"
									type="button"
									aria-label={isPasswordVisible ? authCopy.hidePassword : authCopy.showPassword}
									disabled={isSubmitting}
									onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
								>
									{isPasswordVisible ? (
										<EyeOff className="size-4" aria-hidden="true" />
									) : (
										<Eye className="size-4" aria-hidden="true" />
									)}
								</button>
							</InputGroupAddon>
						</InputGroup>
					</AuthField>

					<Button className="mt-[22px] w-full" size="lg" type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Spinner aria-hidden="true" />
								{copy.pending}
							</>
						) : (
							<>
								{copy.cta}
								<ArrowRight aria-hidden="true" />
							</>
						)}
					</Button>
				</form>

				<p className="mt-5 mb-0 text-center text-[13px] leading-5 text-text-secondary">
					{copy.switchText}{" "}
					<a
						className="rounded-sm font-semibold text-text-primary underline underline-offset-4 outline-none focus-visible:shadow-focus"
						href={getOppositeAuthHref(mode, redirectPath)}
					>
						{copy.switchLabel}
					</a>
				</p>

				<div className="mt-6 flex flex-col gap-2.5 border-sep border-t pt-[18px] text-[13px] leading-[1.45] text-text-secondary">
					{authCopy.trust.map((line) => (
						<div key={line} className="flex gap-2.5">
							<ShieldCheck
								className="mt-0.5 size-[15px] shrink-0 text-status-success-foreground"
								aria-hidden="true"
							/>
							{line}
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
