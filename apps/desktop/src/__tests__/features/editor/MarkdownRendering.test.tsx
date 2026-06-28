import { ReadingView } from "@cortex/editor"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

const kitchenSinkMarkdown = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

Paragraph with **bold**, *italic*, ~~strike~~, \`inline code\`, [link](https://example.com), and [[Linked Note]].

> Blockquote

- [x] Done
- [ ] Todo

| Syntax | Preview |
| --- | --- |
| **table** | *live* |

> [!warning] Styled warning
>
> Callout with **bold** content.

> [!tip]-
> Collapsed callout

\`\`\`ts
const value: number = 1
\`\`\`

\`\`\`tsx
const View = () => <span>{value}</span>
\`\`\`

---

![Alt text](image.png)
`

describe("ReadingView markdown rendering", () => {
	it("renders the Markdown kitchen sink", async () => {
		const { container } = render(<ReadingView content={kitchenSinkMarkdown} />)

		await screen.findByRole("heading", { name: "Heading 1" })
		await waitFor(() => {
			expect(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).toHaveLength(6)
		})

		expect(container.querySelector("blockquote")).toHaveTextContent("Blockquote")
		expect(container.querySelector("table")).toBeInTheDocument()
		expect(container.querySelector("table strong")).toHaveTextContent("table")
		expect(container.querySelector("table em")).toHaveTextContent("live")
		const warningCallout = container.querySelector('[data-callout="warning"]')
		expect(warningCallout).toHaveTextContent("Styled warning")
		expect(warningCallout?.querySelector(".markdown-callout-content strong")).toHaveTextContent(
			"bold",
		)
		const collapsedCallout = container.querySelector<HTMLDetailsElement>('[data-callout="tip"]')
		expect(collapsedCallout).toHaveClass("is-collapsed")
		const calloutToggle = collapsedCallout?.querySelector("[data-callout-toggle]")
		expect(calloutToggle).toBeInTheDocument()
		if (collapsedCallout) {
			collapsedCallout.open = true
			fireEvent(collapsedCallout, new Event("toggle"))
		}
		expect(collapsedCallout).not.toHaveClass("is-collapsed")
		expect(collapsedCallout?.open).toBe(true)
		const taskCheckbox = container.querySelector('[data-task-checkbox="true"]')
		expect(taskCheckbox).toBeInTheDocument()
		expect(taskCheckbox).toHaveAttribute("role", "checkbox")
		expect(taskCheckbox?.querySelector(".markdown-task-checkbox-check")).toBeInTheDocument()
		expect(container.querySelector('[data-wiki-link="Linked Note"]')).toHaveTextContent(
			"Linked Note",
		)
		expect(container.querySelector("pre code")?.textContent).toContain("const value: number = 1")
		expect(container.querySelectorAll("pre code")).toHaveLength(2)
		expect(container.querySelector("img")).toHaveAttribute("src", "image.png")
	})
})
