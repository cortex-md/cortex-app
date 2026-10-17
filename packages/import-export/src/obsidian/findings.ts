export type ObsidianFindingKind =
	| "note-embed"
	| "image-embed"
	| "file-embed"
	| "missing-attachment"
	| "attachment-link"
	| "comment"
	| "block-id"
	| "highlight"
	| "dataview"
	| "templater"
	| "canvas"
	| "excalidraw"
	| "community-plugin"
	| "bookmark"
	| "property-type"
	| "attachment-setting"
	| "date-format"

export interface ObsidianFinding {
	kind: ObsidianFindingKind
	count: number
	examples: string[]
}

export type ObsidianFindings = Map<ObsidianFindingKind, ObsidianFinding>

const MAX_FINDING_EXAMPLES = 5

export function addFinding(
	findings: ObsidianFindings,
	kind: ObsidianFindingKind,
	example?: string,
	count = 1,
): void {
	if (count <= 0) return
	const finding = findings.get(kind) ?? { kind, count: 0, examples: [] }
	finding.count += count
	if (
		example &&
		finding.examples.length < MAX_FINDING_EXAMPLES &&
		!finding.examples.includes(example)
	) {
		finding.examples.push(example)
	}
	findings.set(kind, finding)
}
