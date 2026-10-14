import { useAuthStore } from "@cortex/core"
import type { ReactNode } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { presentSheet } from "@/features/navigation/routes"

export function useSignedIn(): boolean {
	return useAuthStore((state) => state.authenticated)
}

export function RequireAccount({ children }: { children: ReactNode }) {
	const signedIn = useSignedIn()
	if (signedIn) return children
	return (
		<NativeForm>
			<FormSection footer="Sync, sharing and members need a Cortex account. Your vaults keep working offline without one.">
				<FormRow
					icon={{ md: "account_circle", sf: "person.crop.circle" }}
					title="Sign in to continue"
				/>
				<FormRow onPress={() => presentSheet("sign-in")} tint title="Sign in" />
				<FormRow
					onPress={() => presentSheet("sign-in", { mode: "create" })}
					tint
					title="Create account"
				/>
			</FormSection>
		</NativeForm>
	)
}
