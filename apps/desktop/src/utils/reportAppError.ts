import { getPlatform } from "@cortex/platform"

export interface AppOperationError {
	operation: string
	source: string
	cause: unknown
	userMessage?: string
	context?: Record<string, string | number | boolean | null>
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export async function reportAppError(error: AppOperationError): Promise<void> {
	console.error("[Cortex operation failed]", {
		operation: error.operation,
		source: error.source,
		message: getErrorMessage(error.cause),
		context: error.context,
	})
	if (!error.userMessage) return
	try {
		await getPlatform().dialog.showAlert({
			title: "Cortex",
			message: error.userMessage,
			kind: "error",
		})
	} catch (dialogError) {
		console.error("[Cortex error dialog failed]", {
			operation: error.operation,
			message: getErrorMessage(dialogError),
		})
	}
}
