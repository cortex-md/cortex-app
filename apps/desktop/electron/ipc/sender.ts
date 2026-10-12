import { AsyncLocalStorage } from "node:async_hooks"
import type { WebContents } from "electron"

const senderStorage = new AsyncLocalStorage<WebContents>()

export function runWithSender<T>(sender: WebContents, run: () => T): T {
	return senderStorage.run(sender, run)
}

export function getInvokeSender(): WebContents | null {
	return senderStorage.getStore() ?? null
}
