import type { Subscription as ISubscription, SubscriptionStatus } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Subscription implements ISubscription {
	async getStatus(serverUrl: string): Promise<SubscriptionStatus> {
		return await invoke<SubscriptionStatus>("subscription_get_status", { serverUrl })
	}
}
