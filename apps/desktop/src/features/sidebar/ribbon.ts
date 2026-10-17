import { useSettingsStore } from "@cortex/settings"
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"
import type { MenuItem } from "@/utils/context-menu"

export function useRibbonVisible(): boolean {
	return useSettingsStore((state) => state.settings.appearance.showRibbon)
}

export function isRibbonVisible(): boolean {
	return useSettingsStore.getState().settings.appearance.showRibbon
}

export function setRibbonVisible(visible: boolean): void {
	if (isRibbonVisible() === visible) return
	void useSettingsStore.getState().updateSetting("appearance", "showRibbon", visible)
}

export function toggleRibbon(): void {
	setRibbonVisible(!isRibbonVisible())
}

export function ribbonMenuItems(): MenuItem[] {
	const visible = isRibbonVisible()
	return [
		{
			id: "view.toggle-ribbon",
			text: visible ? "Hide ribbon" : "Show ribbon",
			icon: visible ? PanelLeftCloseIcon : PanelLeftOpenIcon,
			action: () => setRibbonVisible(!visible),
		},
	]
}
