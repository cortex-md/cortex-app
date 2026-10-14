import {
	type AddVaultPath,
	NEW_REMOTE,
	type PickedFolderInfo,
	type RemoteVaultOption,
	type SyncMode,
	VAULT_COLORS,
} from "@cortex/core"
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	ColorPicker,
	cn,
	Input,
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
	Label,
	RadioCard,
	RadioGroup,
	Spinner,
	Switch,
} from "@cortex/ui"
import { Cloud, Download, Folder, Laptop, LogIn, Plus, Server, Sparkles } from "lucide-react"
import { type ReactNode, useId } from "react"
import { FlowLabel, FlowLocation, FlowNote } from "../FlowDialog"
import { VaultTile } from "../VaultTile"

const CHOICES: { path: AddVaultPath; title: string; description: string; icon: ReactNode }[] = [
	{
		path: "create",
		title: "Create a new vault",
		description: "Start with an empty folder",
		icon: <Plus />,
	},
	{
		path: "open",
		title: "Open a folder",
		description: "Use notes you already have on this Mac",
		icon: <Folder />,
	},
	{
		path: "download",
		title: "Get a vault from your account",
		description: "Download one you or your team synced before",
		icon: <Download />,
	},
]

export function ChooseStep({ onPick }: { onPick: (path: AddVaultPath) => void }) {
	return (
		<ItemGroup className="gap-1">
			{CHOICES.map((choice) => (
				<Item key={choice.path} asChild className="add-vault-choice">
					<button type="button" onClick={() => onPick(choice.path)}>
						<ItemMedia variant="icon">{choice.icon}</ItemMedia>
						<ItemContent>
							<ItemTitle>{choice.title}</ItemTitle>
							<ItemDescription>{choice.description}</ItemDescription>
						</ItemContent>
					</button>
				</Item>
			))}
		</ItemGroup>
	)
}

interface NameStepProps {
	name: string
	color: string
	location: string
	onNameChange: (name: string) => void
	onColorChange: (color: string) => void
	onChangeLocation: () => void
	onSubmit: () => void
}

export function NameStep({
	name,
	color,
	location,
	onNameChange,
	onColorChange,
	onChangeLocation,
	onSubmit,
}: NameStepProps) {
	return (
		<>
			<div className="mb-4 flex items-center gap-3.5">
				<VaultTile name={name || "Untitled"} color={color} size="lg" />
				<Input
					aria-label="Vault name"
					placeholder="Vault name"
					value={name}
					onChange={(event) => onNameChange(event.target.value)}
					onKeyDown={(event) => event.key === "Enter" && name.trim() && onSubmit()}
					className="add-vault-name-input"
				/>
			</div>
			<ColorPicker
				className="mb-4"
				value={color}
				options={VAULT_COLORS.map((hex) => ({ value: hex }))}
				allowCustom={false}
				allowClear={false}
				aria-label="Vault color"
				onChange={(next) => next && onColorChange(next)}
			/>
			<FlowLabel>Folder</FlowLabel>
			<FlowLocation path={location} onChange={onChangeLocation} />
		</>
	)
}

interface FolderStepProps {
	folder: PickedFolderInfo | null
	picking: boolean
	adoptObsidian: boolean
	onPick: () => void
	onAdoptObsidianChange: (value: boolean) => void
}

export function FolderStep({
	folder,
	picking,
	adoptObsidian,
	onPick,
	onAdoptObsidianChange,
}: FolderStepProps) {
	const switchId = useId()
	if (!folder) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-xl bg-bg-hover px-6 py-8 text-center">
				<Folder className="size-5 text-text-secondary" aria-hidden="true" />
				<span className="text-[13px] text-text-secondary">
					Choose a folder in the system picker.
				</span>
				<Button variant="secondary" onClick={onPick} disabled={picking}>
					{picking ? <Spinner className="size-3.5" /> : null}
					Choose folder…
				</Button>
			</div>
		)
	}
	const note =
		folder.noteCount === null
			? "Looking inside…"
			: folder.noteCount === 0
				? "No Markdown notes yet. It opens as an empty vault."
				: `${folder.name} has ${folder.noteCount} Markdown ${folder.noteCount === 1 ? "note" : "notes"}. They stay where they are; Cortex adds a small .cortex folder.`
	return (
		<>
			<div className="flex items-center gap-3 rounded-xl bg-bg-hover p-3">
				<span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-background text-text-secondary [&_svg]:size-[15px]">
					<Folder />
				</span>
				<span className="min-w-0 flex-1">
					<b className="block truncate text-[13.5px] leading-[18px] font-medium">{folder.name}</b>
					<span className="block truncate font-mono text-[12px] leading-[17px] text-text-secondary">
						{folder.displayPath}
					</span>
				</span>
				<Button variant="ghost" size="xs" onClick={onPick} disabled={picking}>
					Change…
				</Button>
			</div>
			<FlowNote className="mt-3">{note}</FlowNote>
			{folder.obsidian ? (
				<div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-bg-hover p-3">
					<span className="min-w-0">
						<Label htmlFor={switchId} className="text-[13px] font-medium">
							Use Obsidian settings
						</Label>
						<span className="block text-[12px] leading-[17px] text-text-secondary">
							Attachments, daily notes, templates, bookmarks and property types. The .obsidian
							folder is not changed.
						</span>
					</span>
					<Switch
						id={switchId}
						size="sm"
						checked={adoptObsidian}
						onCheckedChange={onAdoptObsidianChange}
					/>
				</div>
			) : null}
		</>
	)
}

export function SyncChoiceStep({
	mode,
	locked,
	onChange,
}: {
	mode: SyncMode | null
	locked: boolean
	onChange: (mode: SyncMode) => void
}) {
	return (
		<RadioGroup
			aria-label="Sync"
			value={mode ?? ""}
			onValueChange={(value) => onChange(value as SyncMode)}
		>
			<RadioCard
				value="keep"
				media={<Laptop />}
				title="Keep it on this Mac"
				description="Plain files. You can turn on sync any time."
			/>
			<RadioCard
				value="sync"
				media={<Cloud />}
				title="Sync it"
				description="Link to a vault in your account, or create one"
				trailing={locked ? "Needs a plan" : undefined}
			/>
		</RadioGroup>
	)
}

interface RemoteStepProps {
	authenticated: boolean
	loading: boolean
	locked: boolean
	selfHosted: boolean
	serverLabel: string
	options: RemoteVaultOption[]
	selected: string | null
	allowNew: boolean
	newRemoteName: string
	newRemoteTarget: string
	onSelect: (id: string) => void
	onNewRemoteNameChange: (name: string) => void
	onSeePlans: () => void
	onSwitchServer: () => void
	onSignIn: () => void
}

export function RemoteStep({
	authenticated,
	loading,
	locked,
	selfHosted,
	serverLabel,
	options,
	selected,
	allowNew,
	newRemoteName,
	newRemoteTarget,
	onSelect,
	onNewRemoteNameChange,
	onSeePlans,
	onSwitchServer,
	onSignIn,
}: RemoteStepProps) {
	const nameId = useId()
	if (!authenticated) {
		return (
			<Alert className="border-0 bg-brand-subtle">
				<LogIn />
				<AlertTitle>Sign in to see your vaults</AlertTitle>
				<AlertDescription>
					<span>Vaults in your account show up here after you sign in.</span>
					<Button size="xs" className="mt-2.5 w-fit" onClick={onSignIn}>
						Sign in…
					</Button>
				</AlertDescription>
			</Alert>
		)
	}
	const disabled = locked
	return (
		<>
			{locked ? (
				<Alert className="mb-3 border-0 bg-brand-subtle">
					<Sparkles />
					<AlertTitle>Syncing with Cortex Cloud needs Hosted Sync</AlertTitle>
					<AlertDescription>
						<span>
							Your vaults are safe and listed below. Pick a plan to use them, or connect your own
							server.
						</span>
						<span className="mt-2.5 flex gap-1.5">
							<Button size="xs" onClick={onSeePlans}>
								See plans
							</Button>
							<Button variant="secondary" size="xs" onClick={onSwitchServer}>
								Use a self-hosted server
							</Button>
						</span>
					</AlertDescription>
				</Alert>
			) : null}
			<div className="mb-2.5 flex items-center justify-between text-[12.5px] leading-none text-text-secondary">
				<span>
					Vaults on <b className="font-medium text-text-primary">{serverLabel}</b>
				</span>
				<Button variant="ghost" size="xs" onClick={onSwitchServer}>
					{selfHosted ? "Use Cortex Cloud" : "Use a self-hosted server"}
				</Button>
			</div>
			{loading && options.length === 0 ? (
				<div className="flex items-center justify-center gap-2 py-6 text-[13px] text-text-secondary">
					<Spinner className="size-3.5" />
					Loading vaults…
				</div>
			) : (
				<RadioGroup
					aria-label="Remote vault"
					value={selected ?? ""}
					onValueChange={onSelect}
					disabled={disabled}
					className={cn("max-h-[260px] overflow-y-auto", disabled && "opacity-55")}
				>
					{options.map((option) => (
						<RadioCard
							key={option.remote.id}
							value={option.remote.id}
							disabled={disabled || option.takenBy !== null}
							media={selfHosted ? <Server /> : <Cloud />}
							title={option.remote.name}
							description={option.description}
						/>
					))}
					{allowNew ? (
						<RadioCard
							value={NEW_REMOTE}
							disabled={disabled}
							media={<Plus />}
							title="Create a new remote vault"
							description={`Upload this vault to ${newRemoteTarget}`}
						/>
					) : null}
					{!allowNew && options.length === 0 ? (
						<p className="m-0 py-6 text-center text-[13px] text-text-secondary">
							No vaults in your account yet.
						</p>
					) : null}
				</RadioGroup>
			)}
			{selected === NEW_REMOTE ? (
				<div className="mt-2.5 ml-[54px] grid gap-1.5">
					<Label htmlFor={nameId} className="text-[12.5px] font-normal text-text-secondary">
						Remote vault name
					</Label>
					<Input
						id={nameId}
						value={newRemoteName}
						onChange={(event) => onNewRemoteNameChange(event.target.value)}
					/>
				</div>
			) : null}
		</>
	)
}

export function LocationStep({
	remoteName,
	location,
	onChangeLocation,
}: {
	remoteName: string
	location: string
	onChangeLocation: () => void
}) {
	return (
		<>
			<FlowLabel>Save “{remoteName}” in</FlowLabel>
			<FlowLocation path={location} onChange={onChangeLocation} />
			<FlowNote className="mt-3">
				Cortex creates this folder, downloads the notes into it and keeps it in sync.
			</FlowNote>
		</>
	)
}
