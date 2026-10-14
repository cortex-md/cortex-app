import {
	formatRelativeTime,
	getFileModifiedTimes,
	getTagPageModel,
	type TagPageNote,
	toVaultRelativePath,
	useTagsStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import {
	Button,
	Chip,
	ColorPicker,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cortex/ui"
import { MoreHorizontalIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import { getSidebarNotePresentation } from "../sidebar/sidebarNotePresentation"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { readTagViewState } from "./tagWorkspaceView"

const EXCERPT_LIMIT = 50

function useNoteExcerpts(vaultPath: string | undefined, filePaths: readonly string[]) {
	const [excerpts, setExcerpts] = useState<Record<string, string>>({})
	const key = filePaths.slice(0, EXCERPT_LIMIT).join("\n")
	useEffect(() => {
		if (!vaultPath || !key) return
		let cancelled = false
		const paths = key.split("\n")
		void Promise.all(
			paths.map(async (filePath) => {
				const id = toVaultRelativePath(filePath, vaultPath) ?? filePath
				const excerpt = await useSearchStore.getState().readNoteExcerpt(id)
				return [filePath, excerpt ?? ""] as const
			}),
		).then((entries) => {
			if (!cancelled) setExcerpts(Object.fromEntries(entries))
		})
		return () => {
			cancelled = true
		}
	}, [key, vaultPath])
	return excerpts
}

function TagActions({
	tag,
	vaultPath,
	onRenamed,
}: {
	tag: string
	vaultPath: string
	onRenamed: (tag: string) => void
}) {
	const color = useTagsStore((state) => state.tagColors[tag] ?? null)
	const [name, setName] = useState(tag)
	const [busy, setBusy] = useState(false)
	const rename = async () => {
		const nextTag = name.trim().replace(/^#/, "")
		if (!nextTag || nextTag === tag) return
		setBusy(true)
		try {
			await useTagsStore.getState().renameTag(vaultPath, tag, nextTag)
			onRenamed(nextTag.toLowerCase())
		} finally {
			setBusy(false)
		}
	}
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Tag actions: rename, change colour">
					<MoreHorizontalIcon />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="tag-page-actions">
				<span className="tag-page-actions-label">Rename tag</span>
				<form
					className="tag-page-rename"
					onSubmit={(event) => {
						event.preventDefault()
						void rename()
					}}
				>
					<Input
						size="sm"
						aria-label="Tag name"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Button type="submit" variant="secondary" size="xs" disabled={busy}>
						Rename
					</Button>
				</form>
				<span className="tag-page-actions-label">Colour</span>
				<ColorPicker
					value={color}
					allowCustom={false}
					onChange={(nextColor) =>
						void useTagsStore.getState().setTagColor(vaultPath, tag, nextColor)
					}
					clearLabel="Clear"
				/>
			</PopoverContent>
		</Popover>
	)
}

function TagNoteRow({
	note,
	vaultPath,
	excerpt,
}: {
	note: TagPageNote
	vaultPath: string
	excerpt: string | undefined
}) {
	const notePath = getSidebarNotePresentation(note.filePath, vaultPath)
	const meta = [notePath.folder, note.modifiedAt ? formatRelativeTime(note.modifiedAt) : ""]
		.filter(Boolean)
		.join(" · ")
	return (
		<Button
			size="sm"
			variant="ghost"
			className="tag-page-note"
			onClick={() => useWorkspaceStore.getState().openTab(note.filePath)}
		>
			<b>{notePath.title}</b>
			<small>{meta}</small>
			{excerpt && <p>{excerpt}</p>}
			{note.tags.length > 0 && (
				<span className="tag-page-note-tags">
					{note.tags.slice(0, 4).map((tag) => (
						<span key={tag} className="note-property-tag-chip">
							#{tag}
						</span>
					))}
				</span>
			)}
		</Button>
	)
}

export function TagPageView({ viewState, onStateChange }: CoreViewProps) {
	const { tag, childTag } = readTagViewState(viewState)
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const fileTags = useTagsStore((state) => state.fileTags)
	const color = useTagsStore((state) => state.tagColors[tag] ?? null)
	const model = useMemo(
		() => getTagPageModel(tag, tagIndex, fileTags, getFileModifiedTimes(files), { childTag }),
		[childTag, fileTags, files, tag, tagIndex],
	)
	const excerpts = useNoteExcerpts(
		vault?.path,
		[...model.recent, ...model.older].map((note) => note.filePath),
	)
	if (!vault) return null

	const searchInTag = () => {
		const query = `tag:${tag} `
		void useSearchStore.getState().runQuery(query)
		const ui = useUIStore.getState()
		if (ui.leftSidebarCollapsed) ui.toggleLeftSidebar()
		ui.setLeftSidebarView("search")
	}

	return (
		<div className="tag-page">
			<div className="tag-page-column">
				<header className="tag-page-head">
					<h1>
						<i style={{ background: color ?? "var(--text-muted)" }} />#{tag}
					</h1>
					<span className="flex-1" />
					<Button variant="secondary" onClick={searchInTag}>
						<SearchIcon />
						Search in tag
					</Button>
					<TagActions
						key={tag}
						tag={tag}
						vaultPath={vault.path}
						onRenamed={(nextTag) => onStateChange({ tag: nextTag })}
					/>
				</header>
				<p className="tag-page-sub">{formatCount(model.noteCount, "note")}</p>
				{model.childTags.length > 0 && (
					<div className="tag-page-chips" role="toolbar" aria-label="Filter by nested tag">
						<Chip size="sm" pressed={!childTag} onClick={() => onStateChange({ tag })}>
							All<span className="tag-page-chip-count">{model.noteCount}</span>
						</Chip>
						{model.childTags.map((child) => (
							<Chip
								key={child.tag}
								size="sm"
								pressed={childTag === child.tag}
								onClick={() => onStateChange({ tag, childTag: child.tag })}
							>
								#{child.tag}
								<span className="tag-page-chip-count">{child.count}</span>
							</Chip>
						))}
					</div>
				)}
				{[
					{ label: "Recently edited", notes: model.recent },
					{ label: "Older", notes: model.older },
				].map(
					(group) =>
						group.notes.length > 0 && (
							<section key={group.label} className="settings-section tag-page-group">
								<div className="settings-section-header">
									<h2 className="settings-section-title">{group.label}</h2>
								</div>
								<div className="settings-group settings-list">
									{group.notes.map((note) => (
										<TagNoteRow
											key={note.filePath}
											note={note}
											vaultPath={vault.path}
											excerpt={excerpts[note.filePath]}
										/>
									))}
								</div>
							</section>
						),
				)}
			</div>
		</div>
	)
}
