import type { CommandEntry, VimCommandChoice } from "./types"

const reservedVimCommands = new Set([
	"colorscheme",
	"colo",
	"map",
	"imap",
	"im",
	"nmap",
	"nm",
	"vmap",
	"vm",
	"omap",
	"om",
	"noremap",
	"no",
	"nnoremap",
	"nn",
	"vnoremap",
	"vn",
	"inoremap",
	"ino",
	"onoremap",
	"ono",
	"unmap",
	"mapclear",
	"mapc",
	"nmapclear",
	"nmapc",
	"vmapclear",
	"vmapc",
	"imapclear",
	"imapc",
	"omapclear",
	"omapc",
	"write",
	"w",
	"undo",
	"u",
	"redo",
	"red",
	"set",
	"se",
	"setlocal",
	"setl",
	"setglobal",
	"setg",
	"sort",
	"sor",
	"substitute",
	"s",
	"startinsert",
	"start",
	"nohlsearch",
	"noh",
	"yank",
	"y",
	"delmarks",
	"delm",
	"marks",
	"registers",
	"reg",
	"vglobal",
	"v",
	"delete",
	"d",
	"join",
	"j",
	"normal",
	"norm",
	"global",
	"g",
])

function shortHash(value: string): string {
	let hash = 5381
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 33) ^ value.charCodeAt(index)
	}
	return (hash >>> 0).toString(36).slice(0, 5)
}

export function normalizeVimCommandName(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^\w]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")

	const usable = normalized || "command"
	const prefixed =
		/^\d/.test(usable) || reservedVimCommands.has(usable) ? `cortex_${usable}` : usable
	return prefixed
}

export function isReservedVimCommandName(value: string): boolean {
	return reservedVimCommands.has(value)
}

export function getPrimaryVimCommandName(command: CommandEntry): string {
	const normalized = normalizeVimCommandName(command.id)
	if (!reservedVimCommands.has(normalized)) return normalized
	return `${normalized}_${shortHash(command.id)}`
}

export function buildVimCommandChoices(commands: CommandEntry[]): VimCommandChoice[] {
	const allNames = new Map<string, VimCommandChoice[]>()

	for (const command of commands) {
		const namesForCommand = new Set<string>()
		const candidates = [
			{ value: command.id, isPrimary: true },
			...(command.aliases ?? []).map((value) => ({ value, isPrimary: false })),
			{ value: command.label, isPrimary: false },
		]

		for (const candidate of candidates) {
			let name = normalizeVimCommandName(candidate.value)
			if (candidate.isPrimary) {
				name = getPrimaryVimCommandName(command)
			} else if (reservedVimCommands.has(name)) {
				continue
			}
			if (namesForCommand.has(name)) continue
			namesForCommand.add(name)

			const choice: VimCommandChoice = {
				name,
				commandId: command.id,
				label: command.label,
				category: command.category,
				isPrimary: candidate.isPrimary,
			}
			allNames.set(name, [...(allNames.get(name) ?? []), choice])
		}
	}

	return Array.from(allNames.values()).flatMap((choices) => {
		if (choices.length === 1) return choices
		const primaryChoices = choices.filter((choice) => choice.isPrimary)
		return primaryChoices.map((choice) => ({
			...choice,
			name: `${choice.name}_${shortHash(choice.commandId)}`,
		}))
	})
}
