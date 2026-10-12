export { extractWikiLinks, type WikiLink } from "./links"
export {
	buildSearchMatches,
	getSearchTerms,
	type SearchMatches,
	type SearchMatchRange,
	type SearchSnippet,
	splitSnippet,
} from "./matches"
export {
	countWords,
	type PreparedSearchContent,
	prepareSearchContent,
	stripMarkdown,
} from "./preprocessor"
export {
	formatSearchFilterSummary,
	getSearchSuggestions,
	hasSearchFilters,
	type ParsedSearchQuery,
	parseSearchQuery,
	removeSearchQueryToken,
	SEARCH_FILTER_KEYS,
	type SearchFilterKey,
	type SearchQueryToken,
	type SearchRequest,
	type SearchSuggestion,
	type SearchSuggestionSources,
	tokenizeSearchQuery,
	toSearchRequest,
} from "./query"
export { SearchEngine } from "./searchEngine"
export { type IndexedFileSnapshot, type NoteSearchHighlight, useSearchStore } from "./searchStore"
export type { SearchDocument, SearchOptions, SearchResult } from "./types"
