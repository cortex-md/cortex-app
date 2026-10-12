export class MobilePathNotFoundError extends Error {}

export function isNotFoundError(error: unknown): boolean {
	return error instanceof MobilePathNotFoundError
}
