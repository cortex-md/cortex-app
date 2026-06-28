import { SettingsPage } from "../SettingsPrimitives"
import { SelfHostedConnection } from "./SelfHostedConnection"
import { SelfHostedEnvironment } from "./SelfHostedEnvironment"

export function SelfHostedPage({ enabled }: { enabled: boolean }) {
	return (
		<SettingsPage>
			<SelfHostedConnection />
			{enabled && <SelfHostedEnvironment />}
		</SettingsPage>
	)
}
