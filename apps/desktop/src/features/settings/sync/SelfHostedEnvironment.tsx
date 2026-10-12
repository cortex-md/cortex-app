import {
	SELF_HOSTED_ENVIRONMENT_GROUPS,
	type SelfHostedEnvironmentField,
	type SelfHostedEnvironmentGroup,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input } from "@cortex/ui"
import {
	ChevronRight,
	ClipboardCopy,
	DatabaseIcon,
	Download,
	HardDriveIcon,
	KeyRoundIcon,
	LockIcon,
	type LucideIcon,
	ServerIcon,
	Settings2Icon,
} from "lucide-react"
import { type ChangeEvent, useState } from "react"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import {
	SettingsField,
	SettingsGroup,
	SettingsIconTile,
	SettingsSection,
} from "../SettingsPrimitives"
import { useSettingsRevealTarget } from "../settingsReveal"
import { useSelfHostedEnvironment } from "./useSelfHostedEnvironment"

interface EnvironmentDisclosureProps {
	group: SelfHostedEnvironmentGroup
	open: boolean
	values: Record<string, string>
	secrets: Record<string, string>
	onOpenChange(open: boolean): void
	onFieldChange(field: SelfHostedEnvironmentField, value: string): Promise<void>
}

const ENVIRONMENT_GROUP_ICONS: Record<string, LucideIcon> = {
	server: ServerIcon,
	database: DatabaseIcon,
	authentication: KeyRoundIcon,
	storage: HardDriveIcon,
}

function EnvironmentDisclosure({
	group,
	open,
	values,
	secrets,
	onOpenChange,
	onFieldChange,
}: EnvironmentDisclosureProps) {
	const fieldCount = group.sections.reduce((count, section) => count + section.fields.length, 0)
	const showSubsectionLabels = group.sections.length > 1
	const GroupIcon = ENVIRONMENT_GROUP_ICONS[group.id] ?? Settings2Icon
	return (
		<Collapsible open={open} onOpenChange={onOpenChange} asChild>
			<SettingsGroup className="settings-env-group">
				<CollapsibleTrigger asChild>
					<Button variant="ghost" aria-label={group.label} className="settings-env-trigger">
						<ChevronRight className="settings-env-chevron" />
						<SettingsIconTile>
							<GroupIcon />
						</SettingsIconTile>
						<span className="settings-env-copy">
							<b>{group.label}</b>
							<span>{group.description}</span>
						</span>
						<span className="settings-count-pill">{fieldCount}</span>
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent
					forceMount
					aria-hidden={!open}
					inert={!open}
					className="settings-env-content grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-200 ease-out data-[state=closed]:invisible data-[state=open]:grid-rows-[1fr] data-[state=open]:visible"
				>
					<div className="min-h-0 overflow-hidden">
						{group.sections.map((section) => (
							<div key={section.id} className="settings-list">
								{showSubsectionLabels && (
									<div className="settings-env-subsection">{section.label}</div>
								)}
								{section.fields.map((field) => (
									<SettingsField
										key={field.key}
										fieldId={`${ENVIRONMENT_FIELD_PREFIX}${field.key}`}
										className="settings-env-field"
										label={field.label}
										description={<code>{field.key}</code>}
										htmlFor={field.key}
										controlClassName="settings-env-control-column"
									>
										<div className="settings-env-control">
											<Input
												id={field.key}
												size="sm"
												type={field.secret ? "password" : "text"}
												value={
													field.secret ? (secrets[field.key] ?? "") : (values[field.key] ?? "")
												}
												onChange={(event: ChangeEvent<HTMLInputElement>) =>
													void onFieldChange(field, event.target.value)
												}
												placeholder={field.defaultValue}
											/>
											{field.secret && (
												<span className="settings-env-secret" title="Stored in the OS keychain">
													<LockIcon />
													Secret
												</span>
											)}
										</div>
									</SettingsField>
								))}
							</div>
						))}
					</div>
				</CollapsibleContent>
			</SettingsGroup>
		</Collapsible>
	)
}

const ENVIRONMENT_FIELD_PREFIX = "sync-self-host.env."

function findEnvironmentGroupId(fieldId: string | undefined): string | null {
	if (!fieldId?.startsWith(ENVIRONMENT_FIELD_PREFIX)) return null
	const key = fieldId.slice(ENVIRONMENT_FIELD_PREFIX.length)
	const group = SELF_HOSTED_ENVIRONMENT_GROUPS.find((candidate) =>
		candidate.sections.some((section) => section.fields.some((field) => field.key === key)),
	)
	return group?.id ?? null
}

export function SelfHostedEnvironment() {
	const { environment, environmentFile, secrets, updateField } = useSelfHostedEnvironment()
	const [copied, showCopied] = useCopyFeedback()
	const [exported, showExported] = useCopyFeedback()
	const [openGroupId, setOpenGroupId] = useState<string | null>(null)
	const revealTarget = useSettingsRevealTarget()
	const [handledRevealNonce, setHandledRevealNonce] = useState<number | null>(null)
	if (revealTarget && revealTarget.nonce !== handledRevealNonce) {
		setHandledRevealNonce(revealTarget.nonce)
		const revealGroupId = findEnvironmentGroupId(revealTarget.fieldId)
		if (revealGroupId) setOpenGroupId(revealGroupId)
	}

	const handleCopy = async () => {
		await getPlatform().clipboard.writeText(environmentFile)
		showCopied()
	}

	const handleExport = async () => {
		const platform = getPlatform()
		const path = await platform.dialog.saveFile({
			title: "Export sync environment",
			defaultPath: ".env",
			filters: [{ name: "Environment file", extensions: ["env"] }],
		})
		if (!path) return
		await platform.fs.writeFile(path, environmentFile)
		showExported()
	}

	return (
		<SettingsSection
			title="Environment"
			footer="Values are saved for this vault. Secrets are stored in the OS keychain."
			action={
				<>
					<Button variant="ghost" size="xs" onClick={() => void handleCopy()}>
						<ClipboardCopy size={14} />
						{copied ? "Copied" : "Copy .env"}
					</Button>
					<Button variant="ghost" size="xs" onClick={() => void handleExport()}>
						<Download size={14} />
						{exported ? "Exported" : "Export"}
					</Button>
				</>
			}
		>
			<div className="settings-env-groups">
				{SELF_HOSTED_ENVIRONMENT_GROUPS.map((group) => (
					<EnvironmentDisclosure
						key={group.id}
						group={group}
						open={openGroupId === group.id}
						values={environment}
						secrets={secrets}
						onOpenChange={(open) => setOpenGroupId(open ? group.id : null)}
						onFieldChange={updateField}
					/>
				))}
			</div>
		</SettingsSection>
	)
}
