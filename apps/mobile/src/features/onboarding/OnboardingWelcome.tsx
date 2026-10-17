import { useAuthStore } from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"
import { FormButton, FormHeader } from "@/features/onboarding/FormControls"
import { accessLabel, type MobileVaultAccess } from "@/features/vault/vaultAccess"

const vaultSymbol: SymbolName = { md: "folder", sf: "folder" }
const lockedSymbol: SymbolName = { md: "lock", sf: "lock" }
const missingSymbol: SymbolName = { md: "warning", sf: "exclamationmark.triangle" }

function recentSymbol(access: MobileVaultAccess | undefined): SymbolName {
	if (access === "needsAccess") return lockedSymbol
	if (access === "missing") return missingSymbol
	return vaultSymbol
}

export function OnboardingWelcome({
	access,
	busy,
	notice,
	onCreate,
	onOpen,
	onOpenRecent,
	onSignIn,
	recentVaults,
}: {
	access: ReadonlyMap<string, MobileVaultAccess>
	busy: boolean
	notice: string | null
	onCreate: () => void
	onOpen: () => void
	onOpenRecent: (entry: VaultRegistryEntry) => void
	onSignIn: () => void
	recentVaults: readonly VaultRegistryEntry[]
}) {
	const hasRecents = recentVaults.length > 0
	const user = useAuthStore((state) => (state.authenticated ? state.user : null))
	return (
		<NativeForm>
			<FormSection>
				<FormHeader subtitle="Notes that stay yours, as plain Markdown files." title="Cortex" />
			</FormSection>
			<FormSection footer={hasRecents ? undefined : (notice ?? undefined)}>
				<FormButton disabled={busy} label="Create new vault" onPress={onCreate} />
				<FormButton disabled={busy} label="Open folder" onPress={onOpen} variant="secondary" />
				{user ? null : (
					<FormButton disabled={busy} label="Sign in" onPress={onSignIn} variant="plain" />
				)}
			</FormSection>
			{user ? (
				<FormSection footer="Create or open a vault, then link it in Settings → Sync.">
					<FormRow subtitle={user.email} title={`Signed in as ${user.displayName ?? user.email}`} />
				</FormSection>
			) : null}
			{hasRecents ? (
				<FormSection footer={notice ?? undefined} title="Recent vaults">
					{recentVaults.slice(0, 8).map((entry) => {
						const state = access.get(entry.uuid)
						return (
							<FormRow
								chevron
								disabled={busy}
								icon={recentSymbol(state)}
								key={entry.uuid}
								onPress={() => onOpenRecent(entry)}
								title={entry.name}
								value={accessLabel(state)}
							/>
						)
					})}
				</FormSection>
			) : null}
		</NativeForm>
	)
}
