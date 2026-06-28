import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { desktopSettingsControls } from "../../../features/settings/desktopSettingsControls"

afterEach(cleanup)

describe("desktopSettingsControls", () => {
	it("commits text input changes on blur without mirroring props into state", async () => {
		const onChange = vi.fn()
		const TextInput = desktopSettingsControls.TextInput
		const { rerender } = render(
			<TextInput value="Initial" placeholder="Plugin setting" onChange={onChange} />,
		)

		const input = screen.getByPlaceholderText("Plugin setting")
		await userEvent.clear(input)
		await userEvent.type(input, "Draft")

		expect(onChange).not.toHaveBeenCalled()

		await userEvent.tab()

		expect(onChange).toHaveBeenCalledWith("Draft")

		rerender(<TextInput value="External" placeholder="Plugin setting" onChange={onChange} />)

		expect(screen.getByPlaceholderText("Plugin setting")).toHaveValue("External")
	})
})
