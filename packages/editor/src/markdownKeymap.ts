import { loadEditorRuntime } from "./runtime"
import type {
	EditorRuntimeCompartment,
	EditorRuntimeKeyBinding,
	EditorRuntimeModules,
	EditorRuntimeView,
} from "./types"

export interface FormatBinding {
	id: string
	keys: string
	enabled: boolean
}

export type MarkdownCommandExecutor = (commandId: string, view: EditorRuntimeView) => boolean

const codeMirrorNamedKeys: Record<string, string> = {
	enter: "Enter",
	escape: "Escape",
	tab: "Tab",
	backspace: "Backspace",
	delete: "Delete",
	space: "Space",
}

function hotkeyToCM6Key(hotkey: string): string {
	return hotkey
		.split("+")
		.map((part, index, parts) => {
			if (index === parts.length - 1) return codeMirrorNamedKeys[part] ?? part
			if (part === "mod") return "Mod"
			return part.charAt(0).toUpperCase() + part.slice(1)
		})
		.join("-")
}

function buildMarkdownKeymap(
	bindings: FormatBinding[],
	executeCommand: MarkdownCommandExecutor | null | undefined,
): EditorRuntimeKeyBinding[] {
	if (!executeCommand) return []
	return bindings.flatMap((binding) =>
		binding.enabled
			? [
					{
						key: hotkeyToCM6Key(binding.keys),
						run: (view) => executeCommand(binding.id, view),
					},
				]
			: [],
	)
}

let markdownKeymapCompartment: EditorRuntimeCompartment | null = null

export function getMarkdownKeymapCompartment(
	runtime: EditorRuntimeModules,
): EditorRuntimeCompartment {
	markdownKeymapCompartment ??= new runtime.state.Compartment()
	return markdownKeymapCompartment
}

export function defaultMarkdownKeymapExtension(
	runtime: EditorRuntimeModules,
	executeCommand?: MarkdownCommandExecutor | null,
) {
	return getMarkdownKeymapCompartment(runtime).of(
		runtime.state.Prec.high(runtime.view.keymap.of(buildMarkdownKeymap([], executeCommand))),
	)
}

export async function reconfigureMarkdownKeymap(
	view: EditorRuntimeView,
	bindings: FormatBinding[],
	executeCommand?: MarkdownCommandExecutor | null,
): Promise<void> {
	const runtime = await loadEditorRuntime()
	view.dispatch({
		effects: getMarkdownKeymapCompartment(runtime).reconfigure(
			runtime.state.Prec.high(
				runtime.view.keymap.of(buildMarkdownKeymap(bindings, executeCommand)),
			),
		),
	})
}
