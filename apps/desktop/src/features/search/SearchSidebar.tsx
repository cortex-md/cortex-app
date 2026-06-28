import { getNotePathPresentation, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@cortex/ui"
import { FileIcon, FilterIcon, FolderIcon, SearchIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const SEARCH_SIDEBAR_RESULT_LIMIT = 100

interface SidebarNotePresentation {
	title: string
	folder: string
}

function highlightSnippet(snippet: string, query: string): React.ReactNode {
	if (!query.trim()) return snippet

	const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
	const regex = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi")
	const parts = snippet.split(regex)

	let offset = 0
	return parts.map((part) => {
		const key = `${offset}-${part}`
		offset += part.length
		const isMatch = terms.some((t) => part.toLowerCase() === t)
		if (isMatch) {
			return (
				<mark key={key} className="sidebar-search-mark">
					{part}
				</mark>
			)
		}
		return part
	})
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getSearchResultPath(resultId: string, vaultPath: string | undefined): string {
	return vaultPath ? `${vaultPath.replace(/\/+$/, "")}/${resultId}` : resultId
}

function getSidebarNotePresentation(
	filePath: string,
	vaultPath: string | undefined,
): SidebarNotePresentation {
	const notePath = getNotePathPresentation(filePath, vaultPath)
	const folder = notePath.segments
		.slice(0, -1)
		.map((segment) => segment.label)
		.join("/")
	return {
		title: notePath.title,
		folder,
	}
}

function formatFilterSummary(parsed: ParsedQuery): string {
	return [
		...parsed.tags.map((tag) => `tag:${tag}`),
		...parsed.paths.map((path) => `path:${path}`),
		...parsed.files.map((file) => `file:${file}`),
	].join(" ")
}

interface ParsedQuery {
	text: string
	tags: string[]
	paths: string[]
	files: string[]
}

function parseSearchQuery(raw: string): ParsedQuery {
	const result: ParsedQuery = { text: "", tags: [], paths: [], files: [] }
	const parts: string[] = []

	const regex = /(tag|path|file):(\S+)/gi
	let lastIndex = 0
	let match: RegExpExecArray | null = null

	match = regex.exec(raw)
	while (match !== null) {
		if (match.index > lastIndex) {
			parts.push(raw.slice(lastIndex, match.index))
		}
		const prefix = match[1].toLowerCase()
		const value = match[2]
		if (prefix === "tag") result.tags.push(value)
		else if (prefix === "path") result.paths.push(value)
		else if (prefix === "file") result.files.push(value)
		lastIndex = regex.lastIndex
		match = regex.exec(raw)
	}

	if (lastIndex < raw.length) {
		parts.push(raw.slice(lastIndex))
	}

	result.text = parts.join("").trim()
	return result
}

export function SearchSidebar() {
	const query = useSearchStore((s) => s.query)
	const results = useSearchStore((s) => s.results)
	const search = useSearchStore((s) => s.search)
	const setQuery = useSearchStore((s) => s.setQuery)
	const indexing = useSearchStore((s) => s.indexing)
	const openTab = useWorkspaceStore((s) => s.openTab)
	const vault = useVaultStore((s) => s.vault)
	const inputRef = useRef<HTMLInputElement>(null)
	const [localQuery, setLocalQuery] = useState(query)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

	const clearPendingSearch = useCallback(() => {
		if (!debounceRef.current) return
		clearTimeout(debounceRef.current)
		debounceRef.current = undefined
	}, [])

	useEffect(() => {
		inputRef.current?.focus()
		return clearPendingSearch
	}, [clearPendingSearch])

	const runSearch = useCallback(
		(rawQuery: string) => {
			const parsed = parseSearchQuery(rawQuery)

			if (
				!parsed.text &&
				parsed.tags.length === 0 &&
				parsed.paths.length === 0 &&
				parsed.files.length === 0
			) {
				setQuery("")
				return
			}

			const searchText =
				parsed.text ||
				parsed.files.join(" ") ||
				parsed.tags.join(" ") ||
				parsed.paths.join(" ") ||
				" "

			search(searchText, {
				tags: parsed.tags.length > 0 ? parsed.tags : undefined,
				folder: parsed.paths.length > 0 ? parsed.paths[0] : undefined,
				files: parsed.files.length > 0 ? parsed.files : undefined,
			})
		},
		[search, setQuery],
	)

	const handleQueryChange = useCallback(
		(value: string) => {
			setLocalQuery(value)
			clearPendingSearch()
			debounceRef.current = setTimeout(() => {
				runSearch(value)
			}, 150)
		},
		[clearPendingSearch, runSearch],
	)

	const handleInsertFilter = useCallback(
		(prefix: string) => {
			const newQuery = `${localQuery} ${prefix}`.trimStart()
			setLocalQuery(newQuery)
			inputRef.current?.focus()
		},
		[localQuery],
	)

	const handleResultClick = useCallback(
		(id: string) => {
			if (!vault) return
			openTab(`${vault.path}/${id}`)
		},
		[vault, openTab],
	)

	const parsed = parseSearchQuery(localQuery)
	const hasFilters = parsed.tags.length > 0 || parsed.paths.length > 0 || parsed.files.length > 0
	const visibleResults = results.slice(0, SEARCH_SIDEBAR_RESULT_LIMIT)
	const filterSummary = hasFilters ? formatFilterSummary(parsed) : ""

	return (
		<div className="sidebar-search-view">
			<div className="sidebar-tool-header">
				<div className="flex items-center gap-1">
					<InputGroup variant="search" className="flex-1" aria-label="Search notes">
						<InputGroupAddon>
							<SearchIcon />
						</InputGroupAddon>
						<InputGroupInput
							ref={inputRef}
							type="text"
							value={localQuery}
							onChange={(e) => handleQueryChange(e.target.value)}
							placeholder="Search in vault..."
						/>
					</InputGroup>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								className="size-9 flex-shrink-0"
								aria-label="Add search filter"
								title="Add filter"
							>
								<FilterIcon className="size-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-60">
							<DropdownMenuLabel>Filter options</DropdownMenuLabel>
							<DropdownMenuItem className="text-sm" onSelect={() => handleInsertFilter("tag:")}>
								<span>tag</span>
								<span className="ml-auto text-muted-foreground">tag:name</span>
							</DropdownMenuItem>
							<DropdownMenuItem className="text-sm" onSelect={() => handleInsertFilter("path:")}>
								<span>path</span>
								<span className="ml-auto text-muted-foreground">path:folder</span>
							</DropdownMenuItem>
							<DropdownMenuItem className="text-sm" onSelect={() => handleInsertFilter("file:")}>
								<span>file name</span>
								<span className="ml-auto text-muted-foreground">file:name</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="sidebar-tool-meta-row">
					<span className="sidebar-tool-count">
						{visibleResults.length !== 0 &&
							`${visibleResults.length} result${visibleResults.length !== 1 ? "s" : ""}`}
					</span>
					{hasFilters && <span className="sidebar-tool-filters">{filterSummary}</span>}
				</div>

				<p className="sidebar-tool-hint">Use tag:, path:, or file: to narrow results</p>
			</div>

			<div className="sidebar-tool-scroll">
				{visibleResults.length === 0 && localQuery.trim() && !indexing && (
					<div className="sidebar-tool-empty">No results found</div>
				)}
				<div className="sidebar-search-results">
					{visibleResults.map((result) => {
						const filePath = getSearchResultPath(result.id, vault?.path)
						const notePath = getSidebarNotePresentation(filePath, vault?.path)
						return (
							<button
								type="button"
								key={result.id}
								className="sidebar-search-result"
								onClick={() => handleResultClick(result.id)}
								aria-label={`Open ${notePath.title}`}
							>
								<span className="sidebar-result-icon">
									<FileIcon className="sidebar-result-file-icon" />
								</span>
								<span className="sidebar-result-body">
									<span className="sidebar-result-title">{notePath.title || result.title}</span>
									{notePath.folder && (
										<span className="sidebar-result-path">
											<FolderIcon className="sidebar-result-folder-icon" />
											<span>{notePath.folder}</span>
										</span>
									)}
									{result.snippet && (
										<span className="sidebar-search-snippet">
											{highlightSnippet(result.snippet, parsed.text)}
										</span>
									)}
								</span>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}
