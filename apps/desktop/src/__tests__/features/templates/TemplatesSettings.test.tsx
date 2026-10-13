import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	toVaultRelativePath: vi.fn(),
	useTemplateStore: vi.fn(),
	useVaultStore: vi.fn(),
}))

vi.mock("@cortex/settings", () => ({
	getSettingsField: vi.fn(),
	useSettingsStore: vi.fn(),
}))

vi.mock("@cortex/editor/editor-view", () => ({
	EditorView: () => null,
}))

import { useTemplateStore, useVaultStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { TemplatesSection } from "../../../features/templates/TemplatesSettings"

const template = {
	id: "weekly",
	name: "Weekly Review",
	description: "",
	bodyPath: "weekly.md",
	targetFolderPattern: "Reviews",
	fileNamePattern: "{{ note.title | slug }}",
	createdAt: "2026-06-18T00:00:00.000Z",
	updatedAt: "2026-06-18T00:00:00.000Z",
}

const templateStoreState = {
	templates: [template],
	ensureTemplatesLoaded: vi.fn(),
	createTemplate: vi.fn(),
	updateTemplate: vi.fn(),
	duplicateTemplate: vi.fn(),
	deleteTemplate: vi.fn(),
	readTemplateBody: vi.fn(),
}

beforeEach(() => {
	vi.mocked(useSettingsStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = {
			settings: {
				appearance: { editorFontSize: 16 },
				editor: {
					wordWrap: true,
					folding: true,
					tabSize: 2,
					useSpaces: true,
					showLineNumbers: false,
					vimMode: false,
				},
				dailyNotes: { folder: "Daily", format: "yyyy-MM-dd", templateId: "" },
				templates: { showTeam: true, editorHintDismissed: false },
			},
			updateSetting: vi.fn(),
		}
		return selector ? selector(state) : state
	}) as never)
	vi.mocked(useVaultStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = { vault: { path: "/vault", name: "Vault" }, files: [], refreshFiles: vi.fn() }
		return selector ? selector(state) : state
	}) as never)
	vi.mocked(useTemplateStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		return selector ? selector(templateStoreState) : templateStoreState
	}) as never)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("TemplatesSection", () => {
	it("summarizes templates and links to the Templates tab", () => {
		render(<TemplatesSection />)

		expect(screen.getByText("1 template")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "New template" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Open Templates" })).toBeInTheDocument()
		expect(screen.getByRole("option", { name: "Weekly Review" })).toBeInTheDocument()
	})
})
