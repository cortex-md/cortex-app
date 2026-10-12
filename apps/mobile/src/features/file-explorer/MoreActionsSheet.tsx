import { ChevronsDown, ChevronsUp, RefreshCw } from "lucide-react-native"

import { ActionSheet } from "@/components/ui/ActionSheet"
import { SheetActionButton } from "@/components/ui/SheetActionButton"

export function MoreActionsSheet({
	allFoldersExpanded,
	isPresented,
	onDismiss,
	onExpandCollapseAll,
	onRefresh,
}: {
	allFoldersExpanded: boolean
	isPresented: boolean
	onDismiss: () => void
	onExpandCollapseAll: () => void
	onRefresh: () => void
}) {
	return (
		<ActionSheet
			isPresented={isPresented}
			onDismiss={onDismiss}
			sectionTitle="Files"
			supportingText="Quick actions for the mobile file explorer."
			title="Explorer options"
		>
			<SheetActionButton
				Icon={allFoldersExpanded ? ChevronsUp : ChevronsDown}
				label={allFoldersExpanded ? "Collapse all folders" : "Expand all folders"}
				onPress={onExpandCollapseAll}
			/>
			<SheetActionButton Icon={RefreshCw} label="Refresh" onPress={onRefresh} />
		</ActionSheet>
	)
}
