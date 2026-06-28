import { type PluginStoreState, pluginStore } from "@cortex/plugin-host-core"
import { useStore } from "zustand/react"

export function usePluginStore<T = PluginStoreState>(selector?: (state: PluginStoreState) => T): T {
	return useStore(pluginStore, selector ?? ((state) => state as T))
}
