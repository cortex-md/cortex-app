import type {
	EditorRuntimeModules,
	EditorRuntimeView,
	VimCommandChoice,
	VimCommandProvider,
} from "./types"

type VimExParams = { input?: string }
type VimApi = EditorRuntimeModules["vim"]

const definedCommandNames = new Set<string>()
const maxVisibleHints = 5
let activeProvider: VimCommandProvider | null = null

function getQuery(input: HTMLInputElement): string {
	return input.value.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
}

function getMatchingChoices(choices: VimCommandChoice[], query: string): VimCommandChoice[] {
	const matches = query
		? choices.filter((choice) => {
				return (
					choice.name.startsWith(query) ||
					choice.label.toLowerCase().includes(query) ||
					choice.category.toLowerCase().includes(query)
				)
			})
		: choices.filter((choice) => choice.isPrimary)
	const commandIds = new Set<string>()
	const uniqueChoices: VimCommandChoice[] = []
	for (const choice of matches) {
		if (commandIds.has(choice.commandId)) continue
		commandIds.add(choice.commandId)
		uniqueChoices.push(choice)
		if (uniqueChoices.length >= maxVisibleHints) break
	}
	return uniqueChoices
}

function renderHints(
	panel: HTMLElement,
	choices: VimCommandChoice[],
	query: string,
	selectedIndex: number,
): void {
	panel.querySelector(".cm-vim-command-hints")?.remove()
	const matches = getMatchingChoices(choices, query)
	if (matches.length === 0) return

	const list = document.createElement("div")
	list.className = "cm-vim-command-hints"
	for (const [index, choice] of matches.entries()) {
		const item = document.createElement("div")
		item.className = "cm-vim-command-hint"
		if (index === selectedIndex) item.dataset.selected = "true"
		const name = document.createElement("span")
		name.className = "cm-vim-command-hint-name"
		name.textContent = choice.name
		const label = document.createElement("span")
		label.className = "cm-vim-command-hint-label"
		label.textContent = `${choice.label} - ${choice.category}`
		item.append(name, label)
		list.append(item)
	}
	panel.append(list)
}

class VimCommandPlugin {
	private choices: VimCommandChoice[] = []
	private input: HTMLInputElement | null = null
	private selectedIndex = 0
	private unsubscribe: (() => void) | null = null

	constructor(
		private view: EditorRuntimeView,
		private provider: VimCommandProvider,
		private vimApi: VimApi,
	) {
		activeProvider = provider
		this.refreshChoices()
		this.unsubscribe = provider.subscribe(() => this.refreshChoices())
		this.attachInput()
	}

	update(): void {
		this.attachInput()
	}

	destroy(): void {
		this.detachInput()
		this.unsubscribe?.()
	}

	private refreshChoices(): void {
		this.choices = this.provider.getChoices()
		for (const choice of this.choices) {
			if (definedCommandNames.has(choice.name)) continue
			definedCommandNames.add(choice.name)
			this.vimApi.Vim.defineEx(choice.name, choice.name, (_cm: unknown, params: VimExParams) => {
				activeProvider?.execute(choice.name, params.input)
			})
		}
		this.renderCurrentHints()
	}

	private attachInput(): void {
		const input = this.view.dom.querySelector<HTMLInputElement>(".cm-vim-panel input")
		if (!input || input === this.input) return
		this.detachInput()
		this.input = input
		input.addEventListener("input", this.handleInput)
		input.addEventListener("keydown", this.handleKeyDown, true)
		this.renderCurrentHints()
	}

	private detachInput(): void {
		if (!this.input) return
		this.input.removeEventListener("input", this.handleInput)
		this.input.removeEventListener("keydown", this.handleKeyDown, true)
		this.input.closest(".cm-vim-panel")?.querySelector(".cm-vim-command-hints")?.remove()
		this.input = null
		this.selectedIndex = 0
	}

	private renderCurrentHints(): void {
		if (!this.input) return
		const panel = this.input.closest<HTMLElement>(".cm-vim-panel")
		if (!panel) return
		const matches = getMatchingChoices(this.choices, getQuery(this.input))
		this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, matches.length - 1))
		renderHints(panel, this.choices, getQuery(this.input), this.selectedIndex)
	}

	private handleInput = (): void => {
		this.selectedIndex = 0
		this.renderCurrentHints()
	}

	private handleKeyDown = (event: KeyboardEvent): void => {
		if (!this.input) return
		const matches = getMatchingChoices(this.choices, getQuery(this.input))
		if (matches.length === 0) return

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault()
			event.stopImmediatePropagation()
			const direction = event.key === "ArrowDown" ? 1 : -1
			this.selectedIndex = (this.selectedIndex + direction + matches.length) % matches.length
			this.renderCurrentHints()
			return
		}

		if (event.key === "Tab") {
			event.preventDefault()
			event.stopImmediatePropagation()
			this.completeInput(matches[this.selectedIndex])
			return
		}

		if (event.key !== "Enter") return
		const query = getQuery(this.input)
		if (matches.some((choice) => choice.name === query)) return
		this.completeInput(matches[this.selectedIndex])
	}

	private completeInput(choice: VimCommandChoice): void {
		if (!this.input) return
		const parts = this.input.value.trim().split(/\s+/)
		parts[0] = choice.name
		this.input.value = parts.join(" ")
		this.input.dispatchEvent(new Event("input", { bubbles: true }))
		this.renderCurrentHints()
	}
}

export function vimCommandExtension(runtime: EditorRuntimeModules, provider: VimCommandProvider) {
	return runtime.view.ViewPlugin.define(
		(view: EditorRuntimeView) => new VimCommandPlugin(view, provider, runtime.vim),
	)
}
