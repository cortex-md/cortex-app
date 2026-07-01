import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReadingView } from "../ReadingView"

afterEach(cleanup)

describe("ReadingView rendering", () => {
	it("keeps rendered markdown inside the editor-aligned content layer", async () => {
		const { container } = render(<ReadingView content="# Heading" />)
		await waitFor(() => expect(container.querySelector("h1")).not.toBeNull())

		expect(container.querySelector(".reading-view-content h1")?.textContent).toBe("Heading")
	})

	it("delegates sanitized external links to the host", async () => {
		const onExternalLinkClick = vi.fn()
		const { container } = render(
			<ReadingView
				content="[Cortex](https://example.com)"
				onExternalLinkClick={onExternalLinkClick}
			/>,
		)
		await waitFor(() => expect(container.querySelector("a")).not.toBeNull())

		fireEvent.click(container.querySelector("a") as HTMLAnchorElement)

		expect(onExternalLinkClick).toHaveBeenCalledWith("https://example.com")
	})

	it("uses the latest external link handler without rebuilding the delegated listener", async () => {
		const firstExternalLinkClick = vi.fn()
		const secondExternalLinkClick = vi.fn()
		const { container, rerender } = render(
			<ReadingView
				content="[Cortex](https://example.com)"
				onExternalLinkClick={firstExternalLinkClick}
			/>,
		)
		await waitFor(() => expect(container.querySelector("a")).not.toBeNull())

		rerender(
			<ReadingView
				content="[Cortex](https://example.com)"
				onExternalLinkClick={secondExternalLinkClick}
			/>,
		)
		fireEvent.click(container.querySelector("a") as HTMLAnchorElement)

		expect(firstExternalLinkClick).not.toHaveBeenCalled()
		expect(secondExternalLinkClick).toHaveBeenCalledWith("https://example.com")
	})

	it("removes unsafe link protocols", async () => {
		const { container } = render(<ReadingView content="[Unsafe](javascript:alert(1))" />)
		await waitFor(() => expect(container.textContent).toContain("Unsafe"))

		expect(container.innerHTML).not.toContain("javascript:")
	})

	it("renders GFM table headers, cells, and alignment metadata", async () => {
		const { container } = render(
			<ReadingView content={"| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |"} />,
		)
		await waitFor(() => expect(container.querySelector("table")).not.toBeNull())

		expect(container.querySelectorAll("th")).toHaveLength(3)
		expect(container.querySelectorAll("td")).toHaveLength(3)
		expect(
			Array.from(container.querySelectorAll<HTMLElement>("th")).map((cell) =>
				cell.getAttribute("align"),
			),
		).toEqual(["left", "center", "right"])
	})

	it("renders unordered, ordered, nested, and task lists", async () => {
		const { container } = render(
			<ReadingView content={"- alpha\n  - nested\n\n1. first\n2. second\n\n- [ ] task"} />,
		)
		await waitFor(() => expect(container.querySelector("ul")).not.toBeNull())

		expect(container.querySelectorAll("ul")).toHaveLength(3)
		expect(container.querySelectorAll("ol")).toHaveLength(1)
		expect(container.querySelectorAll("li")).toHaveLength(5)
		const checkbox = container.querySelector("[data-task-item] [data-task-checkbox]")
		expect(checkbox).not.toBeNull()
		expect(checkbox?.getAttribute("role")).toBe("checkbox")
		expect(checkbox?.getAttribute("aria-checked")).toBe("false")
		expect(checkbox?.querySelector("svg .markdown-task-checkbox-check")).not.toBeNull()
	})

	it("renders line embeds between markdown pieces", async () => {
		const { container } = render(
			<ReadingView
				content={"Before\n{{database:db#view}}\nAfter"}
				lineEmbeds={[
					{
						id: "database",
						parse: (line) => (line === "{{database:db#view}}" ? { id: line } : null),
						render: ({ sourceFrom, sourceTo }) => (
							<div data-testid="database-embed">
								Database {sourceFrom}:{sourceTo}
							</div>
						),
					},
				]}
			/>,
		)
		await waitFor(() =>
			expect(container.querySelector("[data-testid='database-embed']")).not.toBeNull(),
		)

		expect(container.textContent).toContain("Before")
		expect(container.textContent).toContain("Database")
		expect(container.textContent).toContain("After")
		expect(container.textContent).not.toContain("{{database:db#view}}")
	})
})
