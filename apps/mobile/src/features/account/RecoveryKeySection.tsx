import { getPlatform } from "@cortex/platform"

import { FormRow, FormSection } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"

export function RecoveryKeySection({
	onDone,
	recoveryKey,
}: {
	onDone: () => void
	recoveryKey: string
}) {
	return (
		<>
			<FormSection
				footer="Store it somewhere safe. It is the only way back into your encrypted notes if you forget your password."
				title="Your recovery key"
			>
				<FormRow title={recoveryKey} />
				<FormRow
					icon={{ sf: "doc.on.doc", md: "content_copy" }}
					onPress={() => {
						void getPlatform().clipboard.writeText(recoveryKey)
						toast("Recovery key copied")
					}}
					tint
					title="Copy"
				/>
			</FormSection>
			<FormSection>
				<FormRow onPress={onDone} tint title="I saved it" />
			</FormSection>
		</>
	)
}
