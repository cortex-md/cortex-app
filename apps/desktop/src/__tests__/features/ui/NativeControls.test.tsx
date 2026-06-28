import {
	Button,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Slider,
	Switch,
} from "@cortex/ui"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Search } from "lucide-react"
import { describe, expect, it } from "vitest"

describe("native controls", () => {
	it("uses the theme accent for the primary button", () => {
		render(<Button>Continue</Button>)

		const button = screen.getByRole("button", { name: "Continue" })
		expect(button).toHaveAttribute("data-variant", "default")
		expect(button).toHaveClass("bg-brand", "rounded-[var(--control-pill-radius,999px)]")
	})

	it("renders the reference switch size and toggles its state", async () => {
		const user = userEvent.setup()
		render(<Switch aria-label="Sync" />)

		const control = screen.getByRole("switch", { name: "Sync" })
		expect(control).toHaveClass("h-6", "w-[54px]")
		const thumb = control.querySelector('[data-slot="switch-thumb"]')
		expect(thumb).toHaveClass(
			"left-[2px]",
			"h-5",
			"w-8",
			"rounded-full",
			"group-active/switch:w-[35px]",
			"group-active/switch:bg-white/75",
		)

		await user.click(control)

		expect(control).toHaveAttribute("data-state", "checked")
		expect(thumb).toHaveClass("data-[state=checked]:translate-x-[18px]")
	})

	it("renders one slider thumb when no value is provided", () => {
		const { container } = render(<Slider aria-label="Font size" />)

		expect(container.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(1)
	})

	it("composes icon search fields through InputGroup", () => {
		render(
			<InputGroup variant="search" aria-label="Note search">
				<InputGroupAddon>
					<Search />
				</InputGroupAddon>
				<InputGroupInput aria-label="Search notes" />
			</InputGroup>,
		)

		expect(screen.getByRole("group", { name: "Note search" })).toHaveAttribute(
			"data-variant",
			"search",
		)
		expect(screen.getByRole("group", { name: "Note search" })).toHaveClass("h-9", "bg-input-bg")
		expect(screen.getByRole("textbox", { name: "Search notes" })).toHaveAttribute(
			"data-slot",
			"input-group-control",
		)
	})

	it("provides comfortable and compact text field sizes without glass material", () => {
		render(
			<>
				<Input aria-label="Default input" />
				<Input aria-label="Compact input" size="sm" />
				<InputGroup variant="search" size="sm" aria-label="Compact search">
					<InputGroupInput />
				</InputGroup>
			</>,
		)

		expect(screen.getByRole("textbox", { name: "Default input" })).toHaveClass(
			"h-[var(--input-height-md,32px)]",
			"px-3",
			"bg-input-bg",
		)
		expect(screen.getByRole("textbox", { name: "Compact input" })).toHaveClass(
			"h-[var(--control-height-sm,24px)]",
			"px-2",
		)
		expect(screen.getByRole("group", { name: "Compact search" })).toHaveClass("h-8")
		expect(screen.getByRole("textbox", { name: "Default input" })).not.toHaveClass(
			"backdrop-blur-xl",
		)
	})
})
