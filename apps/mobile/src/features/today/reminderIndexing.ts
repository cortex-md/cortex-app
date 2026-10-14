import { useTasksStore, useVaultStore } from "@cortex/core"

const INDEX_DELAY_MS = 4000

export function startReminderIndexing(): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null
	let indexedVaultPath: string | null = null

	const schedule = () => {
		const vault = useVaultStore.getState().vault
		if (!vault || vault.path === indexedVaultPath) return
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			timer = null
			const { vault: current, files } = useVaultStore.getState()
			if (!current || current.path !== vault.path) return
			indexedVaultPath = current.path
			if (useTasksStore.getState().inboxPath) return
			void useTasksStore
				.getState()
				.buildIndexFromFiles(current.path, files)
				.catch(() => {
					indexedVaultPath = null
				})
		}, INDEX_DELAY_MS)
	}

	schedule()
	const unsubscribe = useVaultStore.subscribe((state, previous) => {
		if (state.vault !== previous.vault) schedule()
	})
	return () => {
		if (timer) clearTimeout(timer)
		unsubscribe()
	}
}
