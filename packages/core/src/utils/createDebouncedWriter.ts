export interface DebouncedWriter {
	schedule(write: () => void): void
	cancel(): void
}

export function createDebouncedWriter(delayMs: number): DebouncedWriter {
	let timer: ReturnType<typeof setTimeout> | null = null
	return {
		schedule: (write) => {
			if (timer) clearTimeout(timer)
			timer = setTimeout(() => {
				timer = null
				write()
			}, delayMs)
		},
		cancel: () => {
			if (timer) clearTimeout(timer)
			timer = null
		},
	}
}
