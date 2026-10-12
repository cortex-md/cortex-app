export function unsupportedPhase1<T>(method: string): Promise<T> {
	return Promise.reject(new Error(`${method} is not available in Cortex Mobile yet`))
}

export function noopUnsubscribe() {}
