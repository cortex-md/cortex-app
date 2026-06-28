import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@cortex/ui", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@cortex/ui")>()
	return {
		...actual,
		Slider: ({
			value,
			className,
			onValueChange,
			onValueCommit,
		}: {
			value: number[]
			className?: string
			onValueChange: (value: number[]) => void
			onValueCommit: (value: number[]) => void
		}) => (
			<div data-testid="mock-slider" className={className}>
				<span data-testid="slider-value">{value[0]}</span>
				<button type="button" onClick={() => onValueChange([8])}>
					Drag slider
				</button>
				<button type="button" onClick={() => onValueCommit([8])}>
					Commit slider
				</button>
			</div>
		),
	}
})

import { DesktopSlider } from "../../../features/settings/desktopSettingsControlComponents"

describe("desktop settings controls", () => {
	it("keeps slider drag local and commits persistence once", async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()

		render(<DesktopSlider value={3} min={1} max={10} step={1} onChange={onChange} />)

		const slider = screen.getByTestId("mock-slider")
		expect(slider).toHaveClass("min-w-32", "flex-1")
		expect(slider.parentElement).toHaveClass("w-full", "min-w-0")

		await user.click(screen.getByRole("button", { name: "Drag slider" }))

		expect(screen.getByTestId("slider-value")).toHaveTextContent("8")
		expect(onChange).not.toHaveBeenCalled()

		await user.click(screen.getByRole("button", { name: "Commit slider" }))

		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onChange).toHaveBeenCalledWith(8)
	})
})
