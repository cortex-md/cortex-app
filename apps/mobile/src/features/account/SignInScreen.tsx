import { CLOUD_SERVER_LABEL, getErrorMessage, useAuthStore } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import {
	type AccountServer,
	accountServerUrl,
	checkServerReachable,
	describeServerHost,
	getAccountServer,
	isValidServerUrl,
	selectAccountServer,
} from "@/features/account/accountServer"
import { RecoveryKeySection } from "@/features/account/RecoveryKeySection"
import { toast } from "@/features/feedback/useToast"
import { readParam } from "@/features/history/useVersionHistory"
import { FormHeader, FormPicker } from "@/features/onboarding/FormControls"
import { FormTextField } from "@/features/sync/FormControls"
import { cleanErrorMessage } from "@/features/vault/vaultErrors"

export type AuthMode = "sign-in" | "create"
type ServerKind = "cloud" | "self-hosted"

interface AuthDraft {
	confirm: string
	displayName: string
	email: string
	password: string
	serverKind: ServerKind
	serverUrl: string
}

const MIN_PASSWORD_LENGTH = 8

const serverOptions: { label: string; value: ServerKind }[] = [
	{ label: CLOUD_SERVER_LABEL, value: "cloud" },
	{ label: "Self-hosted", value: "self-hosted" },
]

function initialDraft(): AuthDraft {
	const server = getAccountServer()
	return {
		confirm: "",
		displayName: "",
		email: "",
		password: "",
		serverKind: server.selfHosted ? "self-hosted" : "cloud",
		serverUrl: server.url,
	}
}

function draftServer(draft: AuthDraft): AccountServer {
	return { selfHosted: draft.serverKind === "self-hosted", url: draft.serverUrl.trim() }
}

function validateDraft(mode: AuthMode, draft: AuthDraft): string | null {
	if (draft.serverKind === "self-hosted" && !isValidServerUrl(draft.serverUrl)) {
		return "Enter the server address, like http://192.168.0.10:8080."
	}
	if (!draft.email.trim() || !draft.password) return "Enter your email and password."
	if (mode === "sign-in") return null
	if (!draft.displayName.trim()) return "Enter your name."
	if (draft.password.length < MIN_PASSWORD_LENGTH) {
		return `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`
	}
	if (draft.password !== draft.confirm) return "Passwords do not match."
	return null
}

type AuthOutcome = { ok: true; recoveryKey: string | null } | { ok: false; message: string }

async function authenticate(mode: AuthMode, draft: AuthDraft): Promise<AuthOutcome> {
	const server = draftServer(draft)
	const serverUrl = accountServerUrl(server)
	try {
		if (server.selfHosted && !(await checkServerReachable(serverUrl))) {
			return {
				message: `Couldn't reach ${describeServerHost(serverUrl)}. Check the address and that this phone is on the same network as the server.`,
				ok: false,
			}
		}
		await selectAccountServer(server)
		const auth = useAuthStore.getState()
		const recoveryKey =
			mode === "sign-in"
				? await auth.login(draft.email.trim(), draft.password, serverUrl)
				: await auth.register(
						draft.email.trim(),
						draft.password,
						draft.displayName.trim(),
						serverUrl,
					)
		await useAuthStore.getState().checkAuth(serverUrl)
		return { ok: true, recoveryKey }
	} catch (error) {
		return { message: cleanErrorMessage(getErrorMessage(error)), ok: false }
	}
}

function closeRoute(): void {
	if (router.canGoBack()) router.back()
}

export function SignInScreen() {
	const params = useLocalSearchParams<{ mode?: string | string[] }>()
	return (
		<SignInForm
			initialMode={readParam(params.mode) === "create" ? "create" : "sign-in"}
			onDone={closeRoute}
		/>
	)
}

type UpdateDraft = <K extends keyof AuthDraft>(key: K, value: AuthDraft[K]) => void

function ServerSection({ draft, update }: { draft: AuthDraft; update: UpdateDraft }) {
	const selfHosted = draft.serverKind === "self-hosted"
	return (
		<FormSection
			footer={
				selfHosted
					? "The address of your Cortex Sync server. On your home network, use the computer's IP and port."
					: undefined
			}
			title="Server"
		>
			<FormPicker
				icon={{ md: "dns", sf: "server.rack" }}
				label="Server"
				onChange={(value) => update("serverKind", value)}
				options={serverOptions}
				value={draft.serverKind}
			/>
			{selfHosted ? (
				<FormTextField
					initialValue={draft.serverUrl}
					keyboard="url"
					monospace
					onChangeText={(value) => update("serverUrl", value)}
					placeholder="http://192.168.0.10:8080"
				/>
			) : null}
		</FormSection>
	)
}

function CredentialsSection({
	draft,
	isCreate,
	onSubmit,
	update,
}: {
	draft: AuthDraft
	isCreate: boolean
	onSubmit: () => void
	update: UpdateDraft
}) {
	return (
		<FormSection title="Account">
			{isCreate ? (
				<FormTextField onChangeText={(value) => update("displayName", value)} placeholder="Name" />
			) : null}
			<FormTextField
				initialValue={draft.email}
				keyboard="email"
				onChangeText={(value) => update("email", value)}
				placeholder="Email"
			/>
			<FormTextField
				onChangeText={(value) => update("password", value)}
				onSubmit={isCreate ? undefined : onSubmit}
				placeholder="Password"
				secure
			/>
			{isCreate ? (
				<FormTextField
					onChangeText={(value) => update("confirm", value)}
					onSubmit={onSubmit}
					placeholder="Confirm password"
					secure
				/>
			) : null}
		</FormSection>
	)
}

function RecoveryKeyStep({
	modal,
	onDone,
	recoveryKey,
}: {
	modal: boolean
	onDone: () => void
	recoveryKey: string
}) {
	return (
		<>
			{modal ? null : <Stack.Screen options={{ title: "Recovery key" }} />}
			<NativeForm>
				{modal ? (
					<FormSection>
						<FormHeader title="Recovery key" />
					</FormSection>
				) : null}
				<RecoveryKeySection onDone={onDone} recoveryKey={recoveryKey} />
			</NativeForm>
		</>
	)
}

export function SignInForm({
	initialMode,
	onCancel,
	onDone,
}: {
	initialMode: AuthMode
	onCancel?: () => void
	onDone: () => void
}) {
	const [mode, setMode] = useState<AuthMode>(initialMode)
	const [draft, setDraft] = useState<AuthDraft>(initialDraft)
	const [busy, setBusy] = useState(false)
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
	const isCreate = mode === "create"
	const title = isCreate ? "Create account" : "Sign in"
	const busyTitle = isCreate ? "Creating account…" : "Signing in…"

	const update: UpdateDraft = (key, value) => {
		setDraft((currentDraft) => ({ ...currentDraft, [key]: value }))
	}

	const submit = async () => {
		if (busy) return
		const validation = validateDraft(mode, draft)
		if (validation) {
			Alert.alert(title, validation)
			return
		}
		setBusy(true)
		const outcome = await authenticate(mode, draft)
		setBusy(false)
		if (!outcome.ok) {
			Alert.alert(isCreate ? "Couldn't create the account" : "Couldn't sign in", outcome.message)
			return
		}
		toast(isCreate ? "Account created" : "Signed in")
		if (outcome.recoveryKey) setRecoveryKey(outcome.recoveryKey)
		else onDone()
	}

	const switchMode = () => {
		setMode(isCreate ? "sign-in" : "create")
		setDraft((currentDraft) => ({ ...currentDraft, confirm: "", password: "" }))
	}

	if (recoveryKey) {
		return <RecoveryKeyStep modal={Boolean(onCancel)} onDone={onDone} recoveryKey={recoveryKey} />
	}

	return (
		<>
			{onCancel ? null : <Stack.Screen options={{ title }} />}
			<NativeForm>
				{onCancel ? (
					<FormSection>
						<FormHeader title={title} />
					</FormSection>
				) : null}
				<ServerSection draft={draft} update={update} />
				<CredentialsSection
					draft={draft}
					isCreate={isCreate}
					key={mode}
					onSubmit={() => void submit()}
					update={update}
				/>
				<FormSection>
					<FormRow
						disabled={busy}
						onPress={() => void submit()}
						tint
						title={busy ? busyTitle : title}
					/>
					<FormRow
						disabled={busy}
						onPress={switchMode}
						title={isCreate ? "I already have an account" : "Create an account"}
					/>
					{onCancel ? <FormRow disabled={busy} onPress={onCancel} title="Cancel" /> : null}
				</FormSection>
			</NativeForm>
		</>
	)
}
