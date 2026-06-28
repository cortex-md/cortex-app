import type { SettingsControlComponents } from "@cortex/plugin-host-web"
import {
	DesktopColorPicker,
	DesktopDescription,
	DesktopField,
	DesktopGroup,
	DesktopLabel,
	DesktopNumberInput,
	DesktopSelect,
	DesktopSlider,
	DesktopSwitch,
	DesktopTextInput,
} from "./desktopSettingsControlComponents"

export const desktopSettingsControls: SettingsControlComponents = {
	Group: DesktopGroup,
	Field: DesktopField,
	Switch: DesktopSwitch,
	TextInput: DesktopTextInput,
	NumberInput: DesktopNumberInput,
	Select: DesktopSelect,
	Slider: DesktopSlider,
	ColorPicker: DesktopColorPicker,
	Label: DesktopLabel,
	Description: DesktopDescription,
}
