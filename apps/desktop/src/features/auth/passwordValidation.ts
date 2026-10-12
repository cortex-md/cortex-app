const MIN_PASSWORD_LENGTH = 8

export function validateNewPassword(password: string, confirmation: string): string | null {
	if (password !== confirmation) return "Passwords do not match"
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
	}
	return null
}
