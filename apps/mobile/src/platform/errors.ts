export class MobilePathNotFoundError extends Error {}

export class MobileReauthorizationRequiredError extends Error {
	readonly folderName: string
	readonly vaultPath: string

	constructor(vaultPath: string, folderName: string, options?: ErrorOptions) {
		super(`Cortex needs access to “${folderName}” again.`, options)
		this.folderName = folderName
		this.vaultPath = vaultPath
	}
}

export function isNotFoundError(error: unknown): boolean {
	return error instanceof MobilePathNotFoundError
}

export function isReauthorizationRequiredError(
	error: unknown,
): error is MobileReauthorizationRequiredError {
	return error instanceof MobileReauthorizationRequiredError
}
