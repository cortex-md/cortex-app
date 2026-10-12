import { useMembersStore } from "@cortex/core"
import type { PathGrant, VaultMember } from "@cortex/platform"
import {
	Button,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Spinner,
} from "@cortex/ui"
import { useMemo, useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { SettingsGroup } from "../settings/SettingsPrimitives"
import { GuestAccessEditor } from "./GuestAccessEditor"
import { memberDisplayName, messageOf } from "./memberDirectory"
import { buildUserGrantRules, grantsByUser } from "./memberRoles"

const EMPTY_GRANTS: PathGrant[] = []

interface GuestAccessDialogProps {
	vaultId: string
	member: VaultMember | null
	onClose(): void
}

export function GuestAccessDialog({ vaultId, member, onClose }: GuestAccessDialogProps) {
	return (
		<ModalHost open={member !== null} onOpenChange={(open) => !open && onClose()}>
			{member && (
				<DialogContent className="sm:max-w-[520px]">
					<GuestAccessContent vaultId={vaultId} member={member} />
				</DialogContent>
			)}
		</ModalHost>
	)
}

function GuestAccessContent({ vaultId, member }: { vaultId: string; member: VaultMember }) {
	const accessRules = useMembersStore((state) => state.accessRules)
	const setAccessRule = useMembersStore((state) => state.setAccessRule)
	const grants = useMemo(
		() => grantsByUser(accessRules).get(member.userId) ?? EMPTY_GRANTS,
		[accessRules, member.userId],
	)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const change = async (next: PathGrant[]) => {
		setBusy(true)
		setError(null)
		try {
			const rules = buildUserGrantRules(accessRules, member.userId, grants, next)
			await Promise.all(rules.map((rule) => setAccessRule(vaultId, rule)))
		} catch (cause) {
			setError(messageOf(cause))
		} finally {
			setBusy(false)
		}
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>Access for {memberDisplayName(member)}</DialogTitle>
				<DialogDescription>Guests only see the notes and folders listed here.</DialogDescription>
			</DialogHeader>
			<SettingsGroup>
				<GuestAccessEditor grants={grants} disabled={busy} onChange={(next) => void change(next)} />
			</SettingsGroup>
			{error && <p className="settings-section-error">{error}</p>}
			<DialogFooter>
				{busy && <Spinner className="size-3" />}
				<DialogClose asChild>
					<Button>Done</Button>
				</DialogClose>
			</DialogFooter>
		</>
	)
}
