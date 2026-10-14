export const authCopy = {
	tabsLabel: "Account",
	loginTab: "Sign in",
	signupTab: "Create account",
	login: {
		seoTitle: "Sign in",
		seoDescription: "Sign in to Cortex for hosted Sync and your account.",
		title: "Welcome back",
		sub: "Continue to your account or hosted Sync.",
		cta: "Sign in",
		pending: "Signing in",
		passwordPlaceholder: "Your password",
		switchText: "Don't have an account?",
		switchLabel: "Create account",
	},
	signup: {
		seoTitle: "Create account",
		seoDescription: "Create a Cortex account for hosted Sync.",
		title: "Create your account",
		sub: "Then Cortex signs you in automatically.",
		cta: "Create account",
		pending: "Creating account",
		passwordPlaceholder: "At least 8 characters",
		switchText: "Already have an account?",
		switchLabel: "Sign in",
	},
	nameLabel: "Name",
	namePlaceholder: "How others will see you",
	emailLabel: "Email",
	emailPlaceholder: "you@example.com",
	passwordLabel: "Password",
	showPassword: "Show password",
	hidePassword: "Hide password",
	errorTitle: "Could not continue",
	unavailable: "Cortex Sync is temporarily unavailable. Try again.",
	errors: {
		name: "Enter your name.",
		email: "Enter a valid email address.",
		passwordShort: "Use at least 8 characters.",
		passwordMissing: "Enter your password.",
	},
	passwordHint: (length: number, score: number) => {
		if (length === 0) return "Use at least 8 characters."
		if (length < 8) return `${8 - length} more characters`
		return score >= 3 ? "Strong password" : "Good — add a number or symbol to make it stronger"
	},
	trust: [
		"Your vault stays on your device. An account is only needed for hosted Sync.",
		"Tokens stay in HttpOnly cookies and never go to localStorage.",
	],
} as const
