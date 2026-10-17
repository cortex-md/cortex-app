import { getErrorMessage } from "@cortex/core"
import { useSyncExternalStore } from "react"

export interface TextPromptRequest {
	confirmLabel: string
	initialValue?: string
	message?: string
	placeholder?: string
	submit: (value: string) => Promise<void>
	title: string
	validate?: (value: string) => string | null
}

export interface ActiveTextPrompt extends TextPromptRequest {
	id: number
}

const listeners = new Set<() => void>()
let current: ActiveTextPrompt | null = null
let nextId = 0

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getPrompt(): ActiveTextPrompt | null {
	return current
}

export function openTextPrompt(request: TextPromptRequest): void {
	current = { ...request, id: ++nextId }
	notify()
}

export function closeTextPrompt(id?: number): void {
	if (!current || (id !== undefined && current.id !== id)) return
	current = null
	notify()
}

export function useTextPrompt(): ActiveTextPrompt | null {
	return useSyncExternalStore(subscribe, getPrompt, getPrompt)
}

export async function submitTextPrompt(
	request: TextPromptRequest,
	raw: string,
): Promise<string | null> {
	const value = raw.trim()
	const validationError = request.validate?.(value) ?? null
	if (validationError) return validationError
	try {
		await request.submit(value)
		return null
	} catch (error) {
		return getErrorMessage(error)
	}
}
