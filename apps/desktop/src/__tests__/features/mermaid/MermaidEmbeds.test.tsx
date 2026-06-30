import type { ParsedCodeBlockEmbed } from "@cortex/editor/code-block-embeds"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MermaidEmbedCard } from "../../../features/mermaid/MermaidEmbedCard"
import {
	createMermaidDiagramReference,
	findMermaidDiagramInBody,
	hashMermaidSource,
	MERMAID_FENCE_LANGUAGE,
} from "../../../features/mermaid/mermaidDocument"
import {
	clearMermaidRenderCache,
	namespaceMermaidSvg,
	sanitizeMermaidSvg,
} from "../../../features/mermaid/mermaidRenderer"

const openMermaidModal = vi.hoisted(() => vi.fn())
const openMermaidDiagramTab = vi.hoisted(() => vi.fn())
const mermaidInitialize = vi.hoisted(() => vi.fn())
const mermaidRender = vi.hoisted(() =>
	vi.fn(async (id: string, source: string) => ({
		svg: `<svg id="${id}" viewBox="0 0 120 60"><g id="node-a"><text>${source}</text></g></svg>`,
	})),
)
const dompurifySanitize = vi.hoisted(() => vi.fn((svg: string) => svg))

vi.mock("../../../features/mermaid/mermaidModalStore", () => ({
	openMermaidModal,
}))

vi.mock("../../../features/mermaid/mermaidWorkspace", () => ({
	openMermaidDiagramTab,
}))

vi.mock("mermaid", () => ({
	default: {
		initialize: mermaidInitialize,
		render: mermaidRender,
	},
}))

vi.mock("dompurify", () => ({
	default: {
		sanitize: dompurifySanitize,
	},
}))

function createBlock(content: string): ParsedCodeBlockEmbed {
	return {
		language: MERMAID_FENCE_LANGUAGE,
		info: MERMAID_FENCE_LANGUAGE,
		content,
		sourceFrom: 0,
		sourceTo: content.length,
		contentFrom: 0,
		contentTo: content.length,
		openingFenceFrom: 0,
		openingFenceTo: 0,
		closingFenceFrom: null,
		closingFenceTo: null,
		fence: "```",
		fenceChar: "`",
	}
}

beforeEach(() => {
	clearMermaidRenderCache()
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	clearMermaidRenderCache()
})

describe("Mermaid embeds", () => {
	it("renders Mermaid diagrams and wires modal and tab actions", async () => {
		const source = "flowchart TD\nA --> B"
		const block = createBlock(source)

		render(<MermaidEmbedCard filePath="/vault/Note.md" block={block} />)

		await waitFor(() => {
			expect(document.querySelector(".mermaid-diagram-svg svg")).not.toBeNull()
		})
		expect(mermaidInitialize).toHaveBeenCalledWith(
			expect.objectContaining({
				startOnLoad: false,
				securityLevel: "strict",
				htmlLabels: false,
				flowchart: { htmlLabels: false },
				themeVariables: expect.objectContaining({
					nodeTextColor: expect.any(String),
					textColor: expect.any(String),
				}),
			}),
		)
		expect(mermaidRender).toHaveBeenCalledWith(expect.stringMatching(/^mermaid-mmd-/), source)

		await userEvent.click(screen.getByRole("button", { name: /^open$/i }))
		expect(openMermaidModal).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: "/vault/Note.md",
				source,
				sourceHash: hashMermaidSource(source),
			}),
		)

		await userEvent.click(screen.getByRole("button", { name: /^tab$/i }))
		expect(openMermaidDiagramTab).toHaveBeenCalledWith(
			expect.objectContaining({
				filePath: "/vault/Note.md",
				source,
			}),
		)
	})

	it("shows syntax errors quietly inside the diagram frame", async () => {
		mermaidRender.mockRejectedValueOnce(new Error("Parse error on line 2\nUnexpected token"))

		render(<MermaidEmbedCard filePath="/vault/Note.md" block={createBlock("not a diagram")} />)

		expect(await screen.findByText("Parse error on line 2")).toBeInTheDocument()
	})

	it("sanitizes unsafe SVG and namespaces IDs for repeated diagrams", () => {
		const unsafeSvg = [
			'<svg viewBox="0 0 100 100">',
			"<script>alert(1)</script>",
			"<foreignObject><div>unsafe</div></foreignObject>",
			'<g id="node" onclick="alert(1)" href="javascript:alert(1)">',
			'<path id="edge" marker-end="url(#marker)" />',
			"</g>",
			'<defs><marker id="marker" /></defs>',
			'<use href="#node" aria-labelledby="node edge" />',
			"<style>#node { stroke: red; }</style>",
			"</svg>",
		].join("")

		const sanitized = sanitizeMermaidSvg(unsafeSvg, { sanitize: (svg) => svg })

		expect(sanitized).not.toContain("<script")
		expect(sanitized).not.toContain("<foreignObject")
		expect(sanitized).not.toContain("onclick")
		expect(sanitized).not.toContain("javascript:")

		const namespaced = namespaceMermaidSvg(sanitized, "scope")

		expect(namespaced).toContain('id="scope-node"')
		expect(namespaced).toContain('id="scope-edge"')
		expect(namespaced).toContain('id="scope-marker"')
		expect(namespaced).toContain('href="#scope-node"')
		expect(namespaced).toContain('aria-labelledby="scope-node scope-edge"')
		expect(namespaced).toContain("url(#scope-marker)")
		expect(namespaced).toContain("#scope-node")
	})

	it("resolves tab diagrams by hash when the original source range moved", () => {
		const block = createBlock("flowchart TD\nA --> B")
		const reference = createMermaidDiagramReference("/vault/Note.md", block)
		const movedBody = ["# Heading", "```mermaid", reference.source, "```"].join("\n")

		const resolved = findMermaidDiagramInBody(movedBody, {
			filePath: reference.filePath,
			sourceHash: reference.sourceHash,
			sourceFrom: reference.sourceFrom,
			sourceTo: reference.sourceTo,
			title: reference.title,
		})

		expect(resolved).toMatchObject({
			filePath: "/vault/Note.md",
			source: reference.source,
			sourceHash: reference.sourceHash,
			sourceFrom: movedBody.indexOf("```mermaid"),
		})
	})
})
