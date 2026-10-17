import {
	databaseTemplateShareKey,
	getLinkedRemoteVaultId,
	noteTemplateShareKey,
	type ShareTemplateOptions,
	shareDatabaseTemplate,
	shareNoteTemplate,
	stopSharingTemplate,
	useDatabaseStore,
	useMembersStore,
	useTemplateStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform, type TemplateShareAudience, type TemplateShareInfo } from "@cortex/platform"
import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Checkbox,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	Label,
	RadioCard,
	RadioGroup,
	Textarea,
	toast,
} from "@cortex/ui"
import { CheckIcon, ChevronDownIcon, CloudOffIcon, ShieldCheckIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import { type ShareTemplateTarget, shareTemplateModal } from "./shareActions"
import "./templates.css"
import { openSettings } from "../settings/settingsModal"

const sampleRowCount = 3

export function ShareTemplateHost() {
	return (
		<ModalStoreHost store={shareTemplateModal}>
			{(target) => <ShareTemplateContent target={target} />}
		</ModalStoreHost>
	)
}

function useShareSubject(target: ShareTemplateTarget) {
	const vault = useVaultStore((state) => state.vault)
	const template = useTemplateStore((state) =>
		target.templateId ? state.templates.find((item) => item.id === target.templateId) : undefined,
	)
	const database = useDatabaseStore((state) =>
		target.databasePath ? state.databases[target.databasePath] : undefined,
	)
	const isDatabase = target.kind === "database"
	const name = (isDatabase ? database?.name : template?.name) ?? "Template"
	const key =
		vault && isDatabase && target.databasePath
			? databaseTemplateShareKey(target.databasePath, vault.path)
			: target.templateId
				? noteTemplateShareKey(target.templateId)
				: null
	const description = (isDatabase ? database?.description : template?.description) ?? ""
	return { vault, isDatabase, name, key, description }
}

function ShareTemplateContent({ target }: { target: ShareTemplateTarget }) {
	const { vault, isDatabase, name, key, description: initialDescription } = useShareSubject(target)
	const existing = useTemplateStore((state) => (key ? state.shares[key] : undefined))
	const groups = useMembersStore((state) => state.groups)
	const ensureMembers = useMembersStore((state) => state.ensureMembers)
	const remoteVaultId = getLinkedRemoteVaultId()
	const [audience, setAudience] = useState<TemplateShareAudience>(existing?.audience ?? "team")
	const [groupId, setGroupId] = useState<string | null>(existing?.groupId ?? null)
	const [description, setDescription] = useState(initialDescription)
	const [includeSamples, setIncludeSamples] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [done, setDone] = useState<TemplateShareInfo | null>(null)

	useEffect(() => {
		if (remoteVaultId) void ensureMembers(remoteVaultId).catch(() => undefined)
	}, [ensureMembers, remoteVaultId])

	const groupName =
		groups.find((group) => group.id === groupId)?.name ??
		`Everyone in ${vault?.name ?? "this vault"}`
	const close = () => shareTemplateModal.close()

	if (!remoteVaultId) {
		return (
			<DialogContent className="template-share-dialog">
				<DialogHeader className="sr-only">
					<DialogTitle>Share “{name}”</DialogTitle>
					<DialogDescription>Sync this vault to share templates.</DialogDescription>
				</DialogHeader>
				<Empty className="border-none">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CloudOffIcon />
						</EmptyMedia>
						<EmptyTitle>Sync this vault to share</EmptyTitle>
						<EmptyDescription>
							Templates are shared through the vault’s sync server. Turn on sync, then come back.
						</EmptyDescription>
					</EmptyHeader>
					<Button
						onClick={() => {
							close()
							openSettings("sync")
						}}
					>
						Open Sync settings
					</Button>
				</Empty>
			</DialogContent>
		)
	}

	const handleShare = async () => {
		if (!vault || busy) return
		setBusy(true)
		setError(null)
		const options: ShareTemplateOptions = { audience, groupId, description, includeSamples }
		try {
			const info =
				isDatabase && target.databasePath
					? await shareDatabaseTemplate(vault, target.databasePath, name, options)
					: target.templateId
						? await shareNoteTemplate(vault, target.templateId, options)
						: null
			if (!info) return
			if (info.link && audience === "link") await getPlatform().clipboard.writeText(info.link)
			setDone(info)
		} catch (shareError) {
			setError(shareError instanceof Error ? shareError.message : String(shareError))
		} finally {
			setBusy(false)
		}
	}

	const handleStop = async () => {
		if (!vault || !key || busy) return
		setBusy(true)
		try {
			await stopSharingTemplate(vault, key)
			toast(`Stopped sharing “${name}”`)
			close()
		} catch (stopError) {
			setError(stopError instanceof Error ? stopError.message : String(stopError))
			setBusy(false)
		}
	}

	if (done) {
		const title =
			done.audience === "team"
				? `${done.groupName ?? groupName} can use it now`
				: done.audience === "link"
					? "Link copied"
					: done.status === "rejected"
						? "Couldn’t publish"
						: "Sent for a quick check"
		const text =
			done.audience === "team"
				? `It shows up for them under “From ${done.groupName ?? "your team"}”.`
				: done.audience === "link"
					? "Paste it anywhere. People who open it can add it to their vault."
					: done.status === "rejected"
						? done.reviewNote || "The automatic check didn’t pass."
						: "It’s listed in Marketplace → Templates in a few minutes. We’ll let you know."
		return (
			<DialogContent className="template-share-dialog">
				<DialogHeader>
					<DialogTitle>Shared</DialogTitle>
					<DialogDescription className="sr-only">{title}</DialogDescription>
				</DialogHeader>
				<div className="template-share-done">
					<span className="template-share-done-icon">
						<CheckIcon />
					</span>
					<h3>{title}</h3>
					<p>{text}</p>
					{done.audience === "link" && done.link ? (
						<div className="template-share-link">
							<span>{done.link}</span>
							<Badge variant="secondary">Copied</Badge>
						</div>
					) : null}
				</div>
				<DialogFooter className="template-share-foot">
					<span className="template-new-hint">Change or stop sharing from the same menu.</span>
					<span className="flex-1" />
					<Button onClick={close}>Done</Button>
				</DialogFooter>
			</DialogContent>
		)
	}

	const options: Array<{ value: TemplateShareAudience; title: string; description: string }> = [
		{
			value: "team",
			title: "My team",
			description: `They find it in New ${isDatabase ? "database" : "note from template"}, nothing to install.`,
		},
		{
			value: "link",
			title: "Anyone with the link",
			description: "Not listed anywhere. They preview it and add it to their vault.",
		},
		{
			value: "market",
			title: "Everyone, in the Marketplace",
			description: "Public after a quick automatic check.",
		},
	]
	const cta =
		audience === "team"
			? `Share with ${groupName}`
			: audience === "link"
				? "Create link"
				: "Publish"

	return (
		<DialogContent className="template-share-dialog">
			<DialogHeader>
				<DialogTitle>
					Share “{name}”{isDatabase ? " as a template" : ""}
				</DialogTitle>
				<DialogDescription className="sr-only">Choose who can use this template.</DialogDescription>
			</DialogHeader>
			<div className="template-share-body">
				<Label id="template-share-audience">Who can use it?</Label>
				<RadioGroup
					aria-labelledby="template-share-audience"
					value={audience}
					onValueChange={(value) => setAudience(value as TemplateShareAudience)}
				>
					{options.map((option) => (
						<RadioCard
							key={option.value}
							value={option.value}
							title={option.title}
							description={option.description}
						/>
					))}
				</RadioGroup>
				{audience === "team" ? (
					<div className="template-share-row">
						<span>Group</span>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="secondary" size="xs">
									{groupName}
									<ChevronDownIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuItem onSelect={() => setGroupId(null)}>
									Everyone in {vault?.name ?? "this vault"}
								</DropdownMenuItem>
								{groups.map((group) => (
									<DropdownMenuItem key={group.id} onSelect={() => setGroupId(group.id)}>
										{group.name}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				) : null}
				{audience === "market" ? (
					<Textarea
						aria-label="Description"
						placeholder="One line that says what it’s for"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
					/>
				) : null}
				<Alert>
					<ShieldCheckIcon />
					<AlertDescription>
						{isDatabase
							? "Only the structure is shared: views, properties and row templates. Your notes stay private."
							: "Only the template is shared. Notes made from it stay private."}
					</AlertDescription>
				</Alert>
				{isDatabase ? (
					<Label className="template-share-check">
						<Checkbox
							checked={includeSamples}
							onCheckedChange={(checked) => setIncludeSamples(checked === true)}
						/>
						Include {sampleRowCount} example rows
					</Label>
				) : null}
				{error ? <p className="template-picker-error">{error}</p> : null}
			</div>
			<DialogFooter className="template-share-foot">
				{existing ? (
					<Button variant="ghost" disabled={busy} onClick={() => void handleStop()}>
						Stop sharing
					</Button>
				) : null}
				<span className="flex-1" />
				<Button variant="ghost" onClick={close}>
					Cancel
				</Button>
				<Button
					disabled={busy || (audience === "market" && !description.trim())}
					onClick={() => void handleShare()}
				>
					{cta}
				</Button>
			</DialogFooter>
		</DialogContent>
	)
}
