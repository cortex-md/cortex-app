import { router } from "expo-router"

export function openPluginView(viewKey: string): void {
	router.push({ params: { viewKey }, pathname: "/(notes)/plugin-view" as never })
}
