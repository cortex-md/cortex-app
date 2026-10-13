import { usePluginStore } from "@cortex/plugin-host-core"
import { Stack, useLocalSearchParams } from "expo-router"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { PluginSettingsForm } from "@/features/plugins/PluginSettingsForm"

export function PluginSettingsScreen() {
	const { pageKey } = useLocalSearchParams<{ pageKey?: string }>()
	const page = usePluginStore((state) => state.settingsPages.find((item) => item.key === pageKey))

	return (
		<>
			<Stack.Screen options={{ title: page?.title ?? "Plugin" }} />
			<NativeForm>
				{page?.schema ? (
					<PluginSettingsForm owner={page.owner} schema={page.schema} />
				) : (
					<FormSection footer="Enable the plugin to configure it.">
						<FormRow disabled title="Settings unavailable" />
					</FormSection>
				)}
			</NativeForm>
		</>
	)
}
