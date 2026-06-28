import {
	SELF_HOSTED_ENVIRONMENT_GROUPS,
	type SelfHostedEnvironmentField,
	type SelfHostedEnvironmentGroup,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import {
	Badge,
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Input,
} from "@cortex/ui"
import { ChevronRight, ClipboardCopy, Download } from "lucide-react"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { SettingsField, SettingsGroup, SettingsSection } from "../SettingsPrimitives"
import { useSelfHostedEnvironment } from "./useSelfHostedEnvironment"

interface EnvironmentDisclosureProps {
	group: SelfHostedEnvironmentGroup
	open: boolean
	values: Record<string, string>
	secrets: Record<string, string>
	onOpenChange(open: boolean): void
	onFieldChange(field: SelfHostedEnvironmentField, value: string): Promise<void>
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
	return (
		<Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
			<CollapsibleTrigger asChild>
				<Button
					variant="ghost"
					aria-label={group.label}
					className="h-auto w-full justify-between rounded-none px-4 py-3 text-left hover:bg-muted/50 [&[data-state=open]_.self-host-chevron]:rotate-90"
				>
					<div className="min-w-0">
						<p className="m-0 text-[13px] font-medium text-foreground">{group.label}</p>
						<p className="m-0 mt-0.5 truncate text-xs font-normal text-muted-foreground">
							{group.description}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Badge variant="secondary">{fieldCount}</Badge>
						<ChevronRight className="self-host-chevron size-4 text-muted-foreground transition-transform duration-200" />
					</div>
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent
				forceMount
				aria-hidden={!open}
				inert={!open}
				className="grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-200 ease-out data-[state=closed]:invisible data-[state=open]:grid-rows-[1fr] data-[state=open]:visible"
			>
				<div className="min-h-0 overflow-hidden border-t border-settings-group-divider">
					{group.sections.map((section) => (
						<div key={section.id}>
							{showSubsectionLabels && (
								<div className="border-b border-settings-group-divider bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
									{section.label}
								</div>
							)}
							<div className="divide-y divide-settings-group-divider">
								{section.fields.map((field) => (
									<SettingsField
										key={field.key}
										label={field.label}
										description={field.key}
										htmlFor={field.key}
										controlClassName="max-w-[420px]"
									>
										<Input
											id={field.key}
											type={field.secret ? "password" : "text"}
											value={field.secret ? (secrets[field.key] ?? "") : (values[field.key] ?? "")}
											onChange={(event: ChangeEvent<HTMLInputElement>) =>
												void onFieldChange(field, event.target.value)
											}
											placeholder={field.defaultValue}
										/>
									</SettingsField>
								))}
							</div>
						</div>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

export function SelfHostedEnvironment() {
	const { environment, environmentFile, secrets, updateField } = useSelfHostedEnvironment()
	const [copied, setCopied] = useState(false)
	const [openGroupId, setOpenGroupId] = useState<string | null>(null)
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (copyTimer.current) clearTimeout(copyTimer.current)
		},
		[],
	)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(environmentFile)
		setCopied(true)
		if (copyTimer.current) clearTimeout(copyTimer.current)
		copyTimer.current = setTimeout(() => setCopied(false), 1200)
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
	}

	return (
		<SettingsSection
			title="Environment"
			description="Values are saved for this vault. Secret values are stored in the OS keychain."
			action={
				<>
					<Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
						<ClipboardCopy size={14} />
						{copied ? "Copied" : "Copy .env"}
					</Button>
					<Button variant="secondary" size="sm" onClick={() => void handleExport()}>
						<Download size={14} />
						Export
					</Button>
				</>
			}
		>
			<SettingsGroup>
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
			</SettingsGroup>
		</SettingsSection>
	)
}
