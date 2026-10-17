import type { AppUpdateErrorCode } from "@cortex/platform"

export class UpdateError extends Error {
	readonly code: AppUpdateErrorCode

	constructor(code: AppUpdateErrorCode, message: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = "UpdateError"
		this.code = code
	}
}

export function toUpdateError(error: unknown, fallback: AppUpdateErrorCode): UpdateError {
	if (error instanceof UpdateError) return error
	const message = error instanceof Error ? error.message : String(error)
	return new UpdateError(fallback, message, { cause: error })
}
