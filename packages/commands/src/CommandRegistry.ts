import type {
	CommandEntry,
	CommandExecutionContext,
	CommandRegistrySnapshot,
	CommandRegistrySubscriber,
	VimCommandChoice,
} from "./types"
import { buildVimCommandChoices } from "./vimNames"

export class CommandRegistry {
	private commands = new Map<string, CommandEntry>()
	private subscribers = new Set<CommandRegistrySubscriber>()
	private version = 0
	private commandsCache: CommandEntry[] = []
	private snapshotCache: CommandRegistrySnapshot = { version: 0, commands: [] }
	private vimChoicesCache: VimCommandChoice[] = []
	private vimChoiceByNameCache = new Map<string, VimCommandChoice>()
	private cacheDirty = true

	register(command: CommandEntry): () => void {
		this.commands.set(command.id, command)
		this.notify()
		return () => {
			const current = this.commands.get(command.id)
			if (current !== command) return
			this.commands.delete(command.id)
			this.notify()
		}
	}

	getAll(): CommandEntry[] {
		this.refreshCache()
		return this.commandsCache
	}

	getSnapshot(): CommandRegistrySnapshot {
		this.refreshCache()
		return this.snapshotCache
	}

	get(id: string): CommandEntry | undefined {
		return this.commands.get(id)
	}

	execute(id: string, context: CommandExecutionContext = { source: "api" }): boolean {
		const command = this.commands.get(id)
		if (!command) return false
		try {
			const result = command.execute(context)
			if (result instanceof Promise) {
				void result.catch((error: unknown) => this.reportExecutionError(id, error))
			}
		} catch (error) {
			this.reportExecutionError(id, error)
		}
		return true
	}

	subscribe(subscriber: CommandRegistrySubscriber): () => void {
		this.subscribers.add(subscriber)
		return () => {
			this.subscribers.delete(subscriber)
		}
	}

	getVimChoices(): VimCommandChoice[] {
		this.refreshCache()
		return this.vimChoicesCache
	}

	executeVimCommand(name: string, input?: string): boolean {
		this.refreshCache()
		const choice = this.vimChoiceByNameCache.get(name)
		if (!choice) return false
		return this.execute(choice.commandId, { source: "vim", vimName: name, input })
	}

	clear(): void {
		if (this.commands.size === 0) return
		this.commands.clear()
		this.notify()
	}

	private notify(): void {
		this.version++
		this.cacheDirty = true
		for (const subscriber of this.subscribers) subscriber()
	}

	private reportExecutionError(id: string, error: unknown): void {
		console.error(`Command "${id}" failed`, error)
	}

	private refreshCache(): void {
		if (!this.cacheDirty) return
		this.commandsCache = Array.from(this.commands.values())
		this.snapshotCache = {
			version: this.version,
			commands: this.commandsCache,
		}
		this.vimChoicesCache = buildVimCommandChoices(this.commandsCache)
		this.vimChoiceByNameCache = new Map(this.vimChoicesCache.map((choice) => [choice.name, choice]))
		this.cacheDirty = false
	}
}
