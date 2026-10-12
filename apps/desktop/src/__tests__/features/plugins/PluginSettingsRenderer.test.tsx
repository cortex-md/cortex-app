import type { PluginSettingsSchema } from "@cortex.md/api"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
	PluginSettingsRenderer,
	type SettingsControlComponents,
} from "../../../features/plugins/rendering/PluginSettingsRenderer"

const schema: PluginSettingsSchema = {
	enabled: {
		type: "boolean",
		label: "Enable feature",
		description: "Turn on the plugin feature.",
		default: true,
	},
}

const sliderSchema: PluginSettingsSchema = {
	limit: {
		type: "slider",
		label: "Task limit",
		default: 5,
		min: 1,
		max: 10,
		step: 1,
	},
}

interface SliderProps {
	value: number
	onChange: (value: number) => void
	min: number
	max: number
	step: number
}

function expectSliderProps(props: SliderProps | null): SliderProps {
	expect(props).not.toBeNull()
	return props as SliderProps
}

function createControls(
	overrides: Partial<SettingsControlComponents> = {},
): SettingsControlComponents {
	return {
		Switch: ({ checked }) => (
			<input aria-label="switch" checked={checked} readOnly type="checkbox" />
		),
		TextInput: ({ value }) => <input readOnly value={value} />,
		NumberInput: ({ value }) => <input readOnly type="number" value={value} />,
		Select: ({ value, options }) => (
			<select value={value} onChange={() => {}}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		),
		Slider: ({ value }) => <input readOnly type="range" value={value} />,
		ColorPicker: ({ value }) => <input readOnly type="color" value={value} />,
		Label: ({ children }) => <span>{children}</span>,
		Description: ({ children }) => <p>{children}</p>,
		...overrides,
	}
}

describe("PluginSettingsRenderer", () => {
	it("uses host-provided field and group wrappers when available", () => {
		const onUpdate = vi.fn()
		const controls = createControls({
			Group: ({ children }) => <section data-wrapper="group">{children}</section>,
			Field: ({ label, description, children }) => (
				<div data-wrapper="field">
					<span>{label}</span>
					{description && <small>{description}</small>}
					{children}
				</div>
			),
		})

		const html = renderToStaticMarkup(
			<PluginSettingsRenderer
				schema={schema}
				controls={controls}
				values={{ enabled: true }}
				onUpdate={onUpdate}
			/>,
		)

		expect(html).toContain('data-wrapper="group"')
		expect(html).toContain('data-wrapper="field"')
		expect(html).toContain("Enable feature")
		expect(html).toContain("Turn on the plugin feature.")
	})

	it("keeps the legacy label and description fallback", () => {
		const onUpdate = vi.fn()
		const controls = createControls()

		const html = renderToStaticMarkup(
			<PluginSettingsRenderer
				schema={schema}
				controls={controls}
				values={{ enabled: true }}
				onUpdate={onUpdate}
			/>,
		)

		expect(html).toContain("<span>Enable feature</span>")
		expect(html).toContain("<p>Turn on the plugin feature.</p>")
	})

	it("normalizes numeric slider values before passing them to host controls", () => {
		let sliderProps: SliderProps | null = null
		const controls = createControls({
			Slider: (props) => {
				sliderProps = props
				return <input readOnly type="range" value={props.value} />
			},
		})

		renderToStaticMarkup(
			<PluginSettingsRenderer
				schema={sliderSchema}
				controls={controls}
				values={{ limit: "not-a-number" }}
				onUpdate={vi.fn()}
			/>,
		)

		expect(expectSliderProps(sliderProps).value).toBe(5)

		renderToStaticMarkup(
			<PluginSettingsRenderer
				schema={sliderSchema}
				controls={controls}
				values={{ limit: 99 }}
				onUpdate={vi.fn()}
			/>,
		)

		expect(expectSliderProps(sliderProps).value).toBe(10)
	})

	it("passes slider updates through as numbers", () => {
		const onUpdate = vi.fn()
		let sliderProps: SliderProps | null = null
		const controls = createControls({
			Slider: (props) => {
				sliderProps = props
				return <input readOnly type="range" value={props.value} />
			},
		})

		renderToStaticMarkup(
			<PluginSettingsRenderer
				schema={sliderSchema}
				controls={controls}
				values={{ limit: 5 }}
				onUpdate={onUpdate}
			/>,
		)

		expectSliderProps(sliderProps).onChange(7)

		expect(onUpdate).toHaveBeenCalledWith("limit", 7)
	})
})
