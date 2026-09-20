export interface CortexBridge {
	invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
	on<T>(event: string, listener: (payload: T) => void): () => void
}

declare global {
	interface Window {
		cortex?: CortexBridge
	}
}

export function getCortexBridge(): CortexBridge {
	if (typeof window === "undefined" || !window.cortex) {
		throw new Error("Cortex Electron bridge is not available")
	}
	return window.cortex
}

export async function invoke<T>(
	command: string,
	args: Record<string, unknown> | object = {},
): Promise<T> {
	return await getCortexBridge().invoke<T>(command, args as Record<string, unknown>)
}

export function listen<T>(event: string, listener: (payload: T) => void): () => void {
	return getCortexBridge().on<T>(event, listener)
}
