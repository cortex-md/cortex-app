import { resolveSyncServerUrl, useAuthStore, useRemoteVaultStore, useUIStore } from "@cortex/core"
import {
	Alert,
	AlertDescription,
	Button,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@cortex/ui"
import { CircleAlert, KeyRound, Mail, UserRound } from "lucide-react"
import { type ChangeEvent, type FormEvent, useReducer, useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { validateNewPassword } from "./passwordValidation"
import { RecoveryKeyPanel } from "./RecoveryKeyPanel"

type AuthView = "login" | "register"
type AuthField = "email" | "password" | "displayName" | "confirmPassword"

interface AuthFormState {
	activeView: AuthView
	email: string
	password: string
	displayName: string
	confirmPassword: string
	validationError: string | null
}

type AuthFormAction =
	| { type: "viewChanged"; activeView: AuthView }
	| { type: "fieldChanged"; field: AuthField; value: string }
	| { type: "validationErrorChanged"; error: string | null }

function createAuthFormState(activeView: AuthView): AuthFormState {
	return {
		activeView,
		email: "",
		password: "",
		displayName: "",
		confirmPassword: "",
		validationError: null,
	}
}

function authFormReducer(state: AuthFormState, action: AuthFormAction): AuthFormState {
	switch (action.type) {
		case "viewChanged":
			return { ...state, activeView: action.activeView, validationError: null }
		case "fieldChanged":
			return { ...state, [action.field]: action.value }
		case "validationErrorChanged":
			return { ...state, validationError: action.error }
	}
}

export function AuthModal() {
	const authOpen = useUIStore((s) => s.authOpen)
	const authInitialView = useUIStore((s) => s.authInitialView)
	const closeAuth = useUIStore((s) => s.closeAuth)
	const clearError = useAuthStore((s) => s.clearError)
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null)

	const handleOpenChange = (open: boolean) => {
		if (open || recoveryKey) return
		clearError()
		closeAuth()
	}

	return (
		<ModalHost open={authOpen} onOpenChange={handleOpenChange}>
			<AuthModalContent
				key={authInitialView}
				initialView={authInitialView}
				recoveryKey={recoveryKey}
				onRecoveryKey={setRecoveryKey}
			/>
		</ModalHost>
	)
}

interface AuthModalContentProps {
	initialView: AuthView
	recoveryKey: string | null
	onRecoveryKey(recoveryKey: string | null): void
}

function AuthModalContent({ initialView, recoveryKey, onRecoveryKey }: AuthModalContentProps) {
	const authReturnTo = useUIStore((s) => s.authReturnTo)
	const closeAuth = useUIStore((s) => s.closeAuth)
	const openSettings = useUIStore((s) => s.openSettings)
	const login = useAuthStore((s) => s.login)
	const register = useAuthStore((s) => s.register)
	const loading = useAuthStore((s) => s.loading)
	const error = useAuthStore((s) => s.error)
	const clearError = useAuthStore((s) => s.clearError)
	const syncConfig = useRemoteVaultStore((s) => s.syncConfig)
	const serverUrl = resolveSyncServerUrl(syncConfig)

	const [formState, dispatchForm] = useReducer(authFormReducer, initialView, createAuthFormState)
	const { activeView, email, password, displayName, confirmPassword, validationError } = formState

	const handleSuccess = () => {
		const returnTo = authReturnTo
		closeAuth()
		if (returnTo) {
			openSettings(returnTo)
		}
	}

	const handleViewChange = (value: string) => {
		dispatchForm({ type: "viewChanged", activeView: value as AuthView })
		clearError()
	}

	const handleLogin = async (e: FormEvent) => {
		e.preventDefault()
		dispatchForm({ type: "validationErrorChanged", error: null })
		clearError()
		try {
			const nextRecoveryKey = await login(email, password, serverUrl)
			if (nextRecoveryKey) onRecoveryKey(nextRecoveryKey)
			else handleSuccess()
		} catch {}
	}

	const handleRegister = async (e: FormEvent) => {
		e.preventDefault()
		dispatchForm({ type: "validationErrorChanged", error: null })
		clearError()

		const passwordError = validateNewPassword(password, confirmPassword)
		if (passwordError) {
			dispatchForm({ type: "validationErrorChanged", error: passwordError })
			return
		}

		try {
			const nextRecoveryKey = await register(email, password, displayName, serverUrl)
			if (nextRecoveryKey) onRecoveryKey(nextRecoveryKey)
			else handleSuccess()
		} catch {}
	}

	const displayError = validationError || error

	if (recoveryKey) {
		return (
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[460px]" showCloseButton={false}>
				<RecoveryKeyPanel
					recoveryKey={recoveryKey}
					confirmLabel="Continue"
					onDone={() => {
						onRecoveryKey(null)
						handleSuccess()
					}}
				/>
			</DialogContent>
		)
	}

	return (
		<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>{activeView}</DialogTitle>
			</DialogHeader>

			<Tabs value={activeView} onValueChange={handleViewChange}>
				<TabsList
					variant="line"
					className="mx-6 mt-4 grid w-[calc(100%-3rem)] grid-cols-2 border-b border-border/50 pb-1"
				>
					<TabsTrigger value="login">Sign in</TabsTrigger>
					<TabsTrigger value="register">Create account</TabsTrigger>
				</TabsList>

				<TabsContent value="login" className="px-6 pt-5 pb-6">
					<form onSubmit={handleLogin}>
						<FieldGroup className="gap-4">
							<Field>
								<FieldLabel htmlFor="auth-login-email">Email</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<Mail />
									</InputGroupAddon>
									<InputGroupInput
										id="auth-login-email"
										type="email"
										autoComplete="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											dispatchForm({
												type: "fieldChanged",
												field: "email",
												value: e.target.value,
											})
										}
										required
										disabled={loading}
									/>
								</InputGroup>
							</Field>
							<Field>
								<FieldLabel htmlFor="auth-login-password">Password</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<KeyRound />
									</InputGroupAddon>
									<InputGroupInput
										id="auth-login-password"
										type="password"
										autoComplete="current-password"
										placeholder="Your password"
										value={password}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											dispatchForm({
												type: "fieldChanged",
												field: "password",
												value: e.target.value,
											})
										}
										required
										disabled={loading}
									/>
								</InputGroup>
							</Field>
							{displayError && (
								<Alert variant="destructive">
									<CircleAlert />
									<AlertDescription>{displayError}</AlertDescription>
								</Alert>
							)}
							<Field>
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? "Signing in..." : "Sign in"}
								</Button>
								<FieldDescription className="flex items-center justify-center gap-1 text-center">
									<span>No account yet?</span>
									<Button
										type="button"
										variant="link"
										size="xs"
										className="h-auto px-1"
										onClick={() => handleViewChange("register")}
									>
										Create one
									</Button>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</TabsContent>

				<TabsContent value="register" className="px-6 pt-5 pb-6">
					<form onSubmit={handleRegister}>
						<FieldGroup className="gap-4">
							<Field>
								<FieldLabel htmlFor="auth-register-name">Display name</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<UserRound />
									</InputGroupAddon>
									<InputGroupInput
										id="auth-register-name"
										type="text"
										autoComplete="name"
										placeholder="How others will see you"
										value={displayName}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											dispatchForm({
												type: "fieldChanged",
												field: "displayName",
												value: e.target.value,
											})
										}
										required
										disabled={loading}
									/>
								</InputGroup>
							</Field>
							<Field>
								<FieldLabel htmlFor="auth-register-email">Email</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<Mail />
									</InputGroupAddon>
									<InputGroupInput
										id="auth-register-email"
										type="email"
										autoComplete="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											dispatchForm({
												type: "fieldChanged",
												field: "email",
												value: e.target.value,
											})
										}
										required
										disabled={loading}
									/>
								</InputGroup>
							</Field>
							<Field>
								<FieldLabel htmlFor="auth-register-password">Password</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<KeyRound />
									</InputGroupAddon>
									<InputGroupInput
										id="auth-register-password"
										type="password"
										autoComplete="new-password"
										placeholder="At least 8 characters"
										value={password}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											dispatchForm({
												type: "fieldChanged",
												field: "password",
												value: e.target.value,
											})
										}
										required
										disabled={loading}
									/>
								</InputGroup>
							</Field>
							<Field>
								<FieldLabel htmlFor="auth-register-confirm">Confirm password</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<KeyRound />
									</InputGroupAddon>
									<InputGroupInput
										id="auth-register-confirm"
										type="password"
										autoComplete="new-password"
										placeholder="Repeat your password"
										value={confirmPassword}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											dispatchForm({
												type: "fieldChanged",
												field: "confirmPassword",
												value: e.target.value,
											})
										}
										required
										disabled={loading}
									/>
								</InputGroup>
								<FieldDescription>Must be at least 8 characters long.</FieldDescription>
							</Field>
							{displayError && (
								<Alert variant="destructive">
									<CircleAlert />
									<AlertDescription>{displayError}</AlertDescription>
								</Alert>
							)}
							<Field>
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? "Creating account..." : "Create account"}
								</Button>
								<FieldDescription className="flex items-center justify-center gap-1 text-center">
									<span>Already have an account?</span>
									<Button
										type="button"
										variant="link"
										size="xs"
										className="h-auto px-1"
										onClick={() => handleViewChange("login")}
									>
										Sign in
									</Button>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</TabsContent>
			</Tabs>
		</DialogContent>
	)
}
