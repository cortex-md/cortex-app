export interface StateFileIo {
	readFile(path: string): Promise<string>
	atomicWriteFile(path: string, content: string): Promise<void>
	isNotFound?(error: unknown): boolean
}

export interface StateFileOptions<T> {
	path: string
	parse(raw: Record<string, unknown>): T
	empty(): T
	io(): StateFileIo
	debounceMs?: number
}

export interface StateFile<T> {
	readonly path: string
	read(): Promise<T>
	peek(): T | null
	update(mutate: (current: T) => T, options?: { immediate?: boolean }): Promise<void>
	flush(): Promise<void>
	forget(): void
}

const registry = new Map<string, StateFile<unknown>>()

function parseObject(text: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(text) as unknown
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null
	} catch {
		return null
	}
}

function createStateFile<T>(options: StateFileOptions<T>): StateFile<T> {
	let value: T | null = null
	let loading: Promise<T> | null = null
	let dirty = false
	const dirtyKeys = new Set<string>()
	let timer: ReturnType<typeof setTimeout> | null = null
	let writing: Promise<void> = Promise.resolve()
	let updating: Promise<void> = Promise.resolve()
	let pendingWaiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = []

	const read = (): Promise<T> => {
		if (value !== null) return Promise.resolve(value)
		loading ??= options
			.io()
			.readFile(options.path)
			.then(
				(text) => {
					const parsed = parseObject(text)
					return parsed ? options.parse(parsed) : options.empty()
				},
				() => options.empty(),
			)
			.then((loaded) => {
				value ??= loaded
				loading = null
				return value
			})
		return loading
	}

	const write = (): Promise<void> => {
		if (timer) {
			clearTimeout(timer)
			timer = null
		}
		const waiters = pendingWaiters
		pendingWaiters = []
		const run = writing.then(async () => {
			if (!dirty || value === null) return
			dirty = false
			const keys = [...dirtyKeys]
			dirtyKeys.clear()
			const io = options.io()
			const onDisk = await io.readFile(options.path).then(parseObject, () => null)
			const local = value as Record<string, unknown>
			const merged = onDisk
				? (options.parse({
						...onDisk,
						...Object.fromEntries(keys.map((key) => [key, local[key]])),
					}) as Record<string, unknown>)
				: local
			for (const key of Object.keys(merged)) {
				if (!keys.includes(key)) local[key] = merged[key]
			}
			try {
				await io.atomicWriteFile(options.path, JSON.stringify(merged, null, "\t"))
			} catch (error) {
				for (const key of keys) dirtyKeys.add(key)
				throw error
			}
		})
		writing = run.catch(() => undefined)
		run.then(
			() => {
				for (const waiter of waiters) waiter.resolve()
			},
			(error) => {
				dirty = true
				for (const waiter of waiters) waiter.reject(error)
			},
		)
		return run
	}

	return {
		path: options.path,
		read,
		peek: () => value,
		update: (mutate, updateOptions) => {
			const applied = updating.then(async () => {
				const current = await read()
				const next = mutate(current)
				for (const key of Object.keys(next as Record<string, unknown>)) {
					if (
						(next as Record<string, unknown>)[key] !== (current as Record<string, unknown>)[key]
					) {
						dirtyKeys.add(key)
					}
				}
				value = next
				dirty = true
				const settled = new Promise<void>((resolve, reject) => {
					pendingWaiters.push({ resolve, reject })
				})
				const debounceMs = updateOptions?.immediate ? 0 : (options.debounceMs ?? 0)
				if (debounceMs <= 0) {
					void write().catch(() => undefined)
				} else if (!timer) {
					timer = setTimeout(() => void write().catch(() => undefined), debounceMs)
				}
				return { settled }
			})
			updating = applied.then(
				() => undefined,
				() => undefined,
			)
			return applied.then(({ settled }) => settled)
		},
		flush: async () => {
			await updating
			if (dirty || timer) await write()
			else await writing
		},
		forget: () => {
			if (timer) clearTimeout(timer)
			timer = null
			value = null
			loading = null
			dirty = false
			dirtyKeys.clear()
			registry.delete(options.path)
		},
	}
}

export function getStateFile<T>(options: StateFileOptions<T>): StateFile<T> {
	const existing = registry.get(options.path)
	if (existing) return existing as StateFile<T>
	const file = createStateFile(options)
	registry.set(options.path, file as StateFile<unknown>)
	return file
}

export async function flushStateFiles(pathPrefix?: string): Promise<void> {
	await Promise.all(
		[...registry.values()]
			.filter((file) => !pathPrefix || file.path.startsWith(pathPrefix))
			.map((file) => file.flush()),
	)
}

export async function closeStateFiles(pathPrefix: string): Promise<void> {
	const files = [...registry.values()].filter((file) => file.path.startsWith(pathPrefix))
	await Promise.all(files.map((file) => file.flush().catch(() => undefined)))
	for (const file of files) file.forget()
}

export function resetStateFiles(): void {
	for (const file of [...registry.values()]) file.forget()
}
