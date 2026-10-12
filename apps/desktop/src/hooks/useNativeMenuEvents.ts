import { executeCommand } from "@cortex/commands"
import { reportAppError } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useEffect } from "react"

interface MenuCommandEvent {
	id: string
	payload?: unknown
}

export function useNativeMenuEvents(): void {
	useEffect(
		() =>
			getPlatform().app.onNativeEvent<MenuCommandEvent>("menu-command", (event) => {
				if (!event?.id) return
				Promise.resolve()
					.then(() => executeCommand(event.id, { source: "menu", payload: event.payload }))
					.catch((error) => {
						void reportAppError({ operation: event.id, source: "native-menu", cause: error })
					})
			}),
		[],
	)
}
