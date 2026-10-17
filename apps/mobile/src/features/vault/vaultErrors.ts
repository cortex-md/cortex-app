import { getErrorMessage } from "@cortex/core"
import { Alert } from "react-native"

export function cleanErrorMessage(message: string): string {
	return message.replace(/^(?:\w*Error:\s*)+/u, "")
}

export function showVaultError(title: string, error: unknown): void {
	Alert.alert(title, cleanErrorMessage(getErrorMessage(error)))
}
