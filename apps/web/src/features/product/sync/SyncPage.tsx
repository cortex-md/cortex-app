import { SyncEncryptionSection } from "./SyncEncryptionSection"
import { SyncHero } from "./SyncHero"
import { SyncMembersSection } from "./SyncMembersSection"
import { SyncOfflineSection } from "./SyncOfflineSection"
import { SyncPricingSection } from "./SyncPricingSection"

export function SyncPage() {
	return (
		<>
			<SyncHero />
			<SyncEncryptionSection />
			<SyncMembersSection />
			<SyncOfflineSection />
			<SyncPricingSection />
		</>
	)
}
