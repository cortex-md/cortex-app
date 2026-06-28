import { writeFile } from "node:fs/promises"
import type { FileEntry } from "@cortex/platform"
import { SearchEngine } from "@cortex/search"
import { createRenderer } from "../../../packages/renderer/src"
import {
	buildFileTree,
	type FileTreeNode,
	type FileTreeRow,
	type FileTreeVisibleNodeRow,
	projectVisibleFileTree,
} from "../src/features/file-explorer/fileTree"

type ScaleName = "smoke" | "large" | "stress"
type WorkloadName = "file-tree" | "search" | "renderer"

interface ScaleConfig {
	noteCount: number
	searchNoteCount: number
	renderBlockCount: number
	fileTreeIterations: number
	searchIndexIterations: number
	searchQueryIterations: number
	renderIterations: number
}

interface TimedMeasurement {
	workload: WorkloadName
	scenario: string
	metric: string
	unit: "ms"
	samples: number
	p50: number
	p95: number
	min: number
	max: number
	mean: number
	heapDeltaMb: number
	details: Record<string, number | string>
	signal: string
}

interface ParsedArgs {
	scale: ScaleName
	only: Set<WorkloadName>
	jsonPath: string | null
}

interface SearchDocumentFixture {
	id: string
	title: string
	content: string
	folder: string
	mtime: number
}

const scaleConfigs: Record<ScaleName, ScaleConfig> = {
	smoke: {
		noteCount: 5_000,
		searchNoteCount: 3_000,
		renderBlockCount: 500,
		fileTreeIterations: 5,
		searchIndexIterations: 1,
		searchQueryIterations: 20,
		renderIterations: 3,
	},
	large: {
		noteCount: 50_000,
		searchNoteCount: 20_000,
		renderBlockCount: 2_000,
		fileTreeIterations: 3,
		searchIndexIterations: 1,
		searchQueryIterations: 30,
		renderIterations: 2,
	},
	stress: {
		noteCount: 100_000,
		searchNoteCount: 50_000,
		renderBlockCount: 5_000,
		fileTreeIterations: 2,
		searchIndexIterations: 1,
		searchQueryIterations: 20,
		renderIterations: 1,
	},
}

const rootPath = "/vault"
const allWorkloads: WorkloadName[] = ["file-tree", "search", "renderer"]
let blackhole = 0

function parseArgs(argv: string[]): ParsedArgs {
	let scale: ScaleName = "large"
	let only = new Set<WorkloadName>(allWorkloads)
	let jsonPath: string | null = null

	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index]
		if (arg === "--help" || arg === "-h") {
			printHelp()
			process.exit(0)
		}
		if (arg === "--scale") {
			const value = argv[index + 1] as ScaleName | undefined
			if (!value || !(value in scaleConfigs)) throw new Error("Invalid --scale value")
			scale = value
			index++
			continue
		}
		if (arg === "--only") {
			const value = argv[index + 1]
			if (!value) throw new Error("Missing --only value")
			const selected = value.split(",").map((item) => item.trim()) as WorkloadName[]
			for (const workload of selected) {
				if (!allWorkloads.includes(workload)) throw new Error(`Unknown workload: ${workload}`)
			}
			only = new Set(selected)
			index++
			continue
		}
		if (arg === "--json") {
			jsonPath = argv[index + 1] ?? null
			if (!jsonPath) throw new Error("Missing --json path")
			index++
			continue
		}
		throw new Error(`Unknown argument: ${arg}`)
	}

	return { scale, only, jsonPath }
}

function printHelp(): void {
	console.log(`Usage: bun apps/desktop/benchmarks/large-vault-workbench.ts [options]

Options:
  --scale smoke|large|stress   Dataset size. Default: large.
  --only file-tree,search      Comma-separated workloads. Default: all.
  --json path                  Write raw measurements as JSON.

The workbench reports review signals, not pass/fail claims. Use smoke for quick verification and
large/stress for local profiling before changing hot paths.`)
}

function percentile(sorted: number[], percentileValue: number): number {
	if (sorted.length === 0) return 0
	const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)
	return sorted[index]
}

function round(value: number, decimals = 2): number {
	const factor = 10 ** decimals
	return Math.round(value * factor) / factor
}

function heapUsedMb(): number {
	return process.memoryUsage().heapUsed / 1024 / 1024
}

async function measure(
	workload: WorkloadName,
	scenario: string,
	metric: string,
	iterations: number,
	details: Record<string, number | string>,
	run: () => void | Promise<void>,
): Promise<TimedMeasurement> {
	await run()
	const heapBefore = heapUsedMb()
	const samples: number[] = []
	for (let index = 0; index < iterations; index++) {
		const startedAt = performance.now()
		await run()
		samples.push(performance.now() - startedAt)
	}
	const heapAfter = heapUsedMb()
	const sorted = [...samples].sort((left, right) => left - right)
	const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
	const result = {
		workload,
		scenario,
		metric,
		unit: "ms" as const,
		samples: samples.length,
		p50: round(percentile(sorted, 0.5)),
		p95: round(percentile(sorted, 0.95)),
		min: round(sorted[0] ?? 0),
		max: round(sorted.at(-1) ?? 0),
		mean: round(mean),
		heapDeltaMb: round(heapAfter - heapBefore),
		details,
		signal: "",
	}
	return { ...result, signal: reviewSignal(result) }
}

function reviewSignal(measurement: Omit<TimedMeasurement, "signal">): string {
	if (measurement.metric.includes("interactive") && measurement.p95 > 16) {
		return "review: p95 exceeds 16ms interactive budget"
	}
	if (measurement.metric.includes("flatten") && measurement.p95 > 50) {
		return "review: visible-row projection may block a frame on large expansions"
	}
	if (measurement.metric.includes("index")) {
		const documents = Number(measurement.details.documents ?? 0)
		const msPerTenThousand = documents > 0 ? (measurement.p95 / documents) * 10_000 : 0
		if (msPerTenThousand > 1_500) return "review: index cost is high per 10k notes"
	}
	if (measurement.metric.includes("query") && measurement.p95 > 50) {
		return "review: query p95 exceeds fast sidebar response budget"
	}
	if (measurement.metric.includes("render") && measurement.p95 > 250) {
		return "review: markdown render may be visible during reading-view open"
	}
	return "ok"
}

function getParentPath(path: string): string {
	const index = path.lastIndexOf("/")
	return index <= 0 ? rootPath : path.slice(0, index)
}

function addDirectory(entries: FileEntry[], seenDirs: Set<string>, path: string): void {
	if (path === rootPath || seenDirs.has(path)) return
	const parent = getParentPath(path)
	addDirectory(entries, seenDirs, parent)
	seenDirs.add(path)
	entries.push({ path, name: path.split("/").at(-1) ?? path, isDir: true })
}

function createBalancedEntries(noteCount: number): FileEntry[] {
	const entries: FileEntry[] = []
	const dirs = new Set<string>()
	for (let index = 0; index < noteCount; index++) {
		const area = Math.floor(index / 5_000)
		const folder = Math.floor(index / 100)
		const dir = `${rootPath}/area-${area}/folder-${folder}`
		addDirectory(entries, dirs, dir)
		entries.push({
			path: `${dir}/note-${index}.md`,
			name: `note-${index}.md`,
			isDir: false,
			mtime: 1_700_000_000 + index,
			size: 1_024 + (index % 128),
		})
	}
	return entries
}

function createDeepEntries(noteCount: number): FileEntry[] {
	const entries: FileEntry[] = []
	const dirs = new Set<string>()
	for (let index = 0; index < noteCount; index++) {
		const lane = index % 12
		const bucket = Math.floor(index / 250)
		const dir = `${rootPath}/lane-${lane}/year-${2020 + (bucket % 8)}/quarter-${
			bucket % 4
		}/project-${bucket}`
		addDirectory(entries, dirs, dir)
		entries.push({
			path: `${dir}/meeting-${index}.md`,
			name: `meeting-${index}.md`,
			isDir: false,
			mtime: 1_700_500_000 + index,
			size: 2_048 + (index % 256),
		})
	}
	return entries
}

function createFlatEntries(noteCount: number): FileEntry[] {
	return Array.from({ length: noteCount }, (_, index) => ({
		path: `${rootPath}/flat-note-${index}.md`,
		name: `flat-note-${index}.md`,
		isDir: false,
		mtime: 1_701_000_000 + index,
		size: 512 + (index % 64),
	}))
}

function getDirectoryPaths(entries: readonly FileEntry[]): string[] {
	return entries.flatMap((entry) => (entry.isDir ? [entry.path] : []))
}

function runSidebarClickBookkeeping(
	nodeRows: FileTreeVisibleNodeRow[],
	nodeByPath: Map<string, FileTreeNode>,
	nodeRowIndexByPath: Map<string, number>,
	activeFilePath: string,
	focusedPathOverride: string | null,
): string {
	const focusedPath =
		focusedPathOverride && nodeByPath.has(focusedPathOverride)
			? focusedPathOverride
			: ((activeFilePath && nodeByPath.has(activeFilePath)
					? activeFilePath
					: nodeRows[0]?.node.path) ?? null)
	const focusedNode = focusedPath ? (nodeByPath.get(focusedPath) ?? null) : null
	const focusedNodeIndex = focusedPath ? (nodeRowIndexByPath.get(focusedPath) ?? -1) : -1
	return `${focusedNode?.path ?? ""}:${focusedNodeIndex}`
}

async function runFileTreeBenchmarks(config: ScaleConfig): Promise<TimedMeasurement[]> {
	const measurements: TimedMeasurement[] = []
	const shapes = [
		{ name: "balanced", entries: createBalancedEntries(config.noteCount) },
		{ name: "deep", entries: createDeepEntries(config.noteCount) },
		{ name: "flat-root", entries: createFlatEntries(config.noteCount) },
	]

	for (const shape of shapes) {
		let rows: FileTreeRow[] = []
		let tree = buildFileTree(shape.entries, rootPath)
		const directoryPaths = getDirectoryPaths(shape.entries)
		const expandedAll = new Set(directoryPaths)
		const expandedFirst = new Set(directoryPaths.slice(0, 50))

		measurements.push(
			await measure(
				"file-tree",
				shape.name,
				"build + flatten representative",
				config.fileTreeIterations,
				{ entries: shape.entries.length, expanded: expandedFirst.size },
				() => {
					tree = buildFileTree(shape.entries, rootPath)
					rows = projectVisibleFileTree(tree, expandedFirst, null, null).rows
					blackhole += rows.length
				},
			),
		)

		measurements.push(
			await measure(
				"file-tree",
				shape.name,
				"flatten all expanded",
				config.fileTreeIterations,
				{ entries: shape.entries.length, expanded: expandedAll.size },
				() => {
					rows = projectVisibleFileTree(tree, expandedAll, null, null).rows
					blackhole += rows.length
				},
			),
		)

		const lastFile = shape.entries.findLast((entry) => !entry.isDir)?.path ?? rootPath
		const projection = projectVisibleFileTree(tree, expandedAll, null, null)
		rows = projection.rows
		measurements.push(
			await measure(
				"file-tree",
				shape.name,
				"interactive row bookkeeping",
				Math.max(10, config.fileTreeIterations * 10),
				{ rows: rows.length },
				() => {
					blackhole += runSidebarClickBookkeeping(
						projection.nodeRows,
						projection.nodeByPath,
						projection.nodeRowIndexByPath,
						lastFile,
						lastFile,
					).length
				},
			),
		)
	}

	return measurements
}

function createSearchContent(index: number): string {
	const tags = [`project-${index % 19}`, `area-${index % 7}`, index % 97 === 0 ? "rare" : "common"]
	const aliases = [`alias-${index}`, `topic-${index % 31}`]
	const bodySeed = `Cortex local-first markdown note ${index}. common-term area-${
		index % 7
	}. ${index % 997 === 0 ? `rare-tail-${index}` : ""}`
	const paragraphs = Array.from({ length: index % 11 === 0 ? 18 : 5 }, (_, paragraphIndex) => {
		return `${bodySeed} Paragraph ${paragraphIndex} includes [[Wiki ${index % 200}]], #tag-${
			index % 23
		}, and repeated project language for ranking.`
	}).join("\n\n")
	return `---
tags:
${tags.map((tag) => `  - ${tag}`).join("\n")}
aliases:
${aliases.map((alias) => `  - ${alias}`).join("\n")}
---

# Note ${index}

${paragraphs}`
}

function createSearchDocuments(count: number): SearchDocumentFixture[] {
	return Array.from({ length: count }, (_, index) => {
		const folder = `area-${index % 7}/project-${Math.floor(index / 250)}`
		return {
			id: `${folder}/note-${index}.md`,
			title: `Note ${index}`,
			content: createSearchContent(index),
			folder,
			mtime: 1_700_000_000 + index,
		}
	})
}

function indexDocuments(documents: readonly SearchDocumentFixture[]): SearchEngine {
	const engine = new SearchEngine()
	for (const document of documents) {
		engine.addDocument(
			document.id,
			document.title,
			document.content,
			document.folder,
			document.mtime,
		)
	}
	return engine
}

async function runSearchBenchmarks(config: ScaleConfig): Promise<TimedMeasurement[]> {
	const documents = createSearchDocuments(config.searchNoteCount)
	const measurements: TimedMeasurement[] = []
	let engine = indexDocuments(documents)

	measurements.push(
		await measure(
			"search",
			"mixed-frontmatter",
			"index all notes",
			config.searchIndexIterations,
			{ documents: documents.length },
			() => {
				engine = indexDocuments(documents)
				blackhole += engine.documentCount
			},
		),
	)

	const queryCases = [
		{ name: "common full-text query", run: () => engine.search("common-term") },
		{ name: "rare full-text query", run: () => engine.search("rare-tail-997") },
		{ name: "tag filtered query", run: () => engine.search("project", { tags: ["project-7"] }) },
		{ name: "title query", run: () => engine.searchTitles("Note 42") },
	]

	for (const queryCase of queryCases) {
		measurements.push(
			await measure(
				"search",
				"mixed-frontmatter",
				`query ${queryCase.name}`,
				config.searchQueryIterations,
				{ documents: documents.length },
				() => {
					blackhole += queryCase.run().length
				},
			),
		)
	}

	measurements.push(
		await measure(
			"search",
			"mixed-frontmatter",
			"serialize index",
			Math.max(3, config.searchIndexIterations * 3),
			{ documents: documents.length },
			() => {
				blackhole += engine.serialize().length
			},
		),
	)

	return measurements
}

function createRenderDocument(blockCount: number): string {
	const blocks = Array.from({ length: blockCount }, (_, index) => {
		if (index % 29 === 0) {
			return `> [!warning]+ Section ${index}
> Important paragraph with **bold**, [external link](https://example.com/${index}), and [[Wiki ${index}]].`
		}
		if (index % 23 === 0) {
			return `| Key | Value | Notes |
| --- | ---: | --- |
| row-${index} | ${index} | *markdown* content |`
		}
		if (index % 19 === 0) {
			return `\`\`\`ts
export const value${index} = ${index}
export function compute${index}() {
	return value${index} * 2
}
\`\`\``
		}
		if (index % 13 === 0) return `- [${index % 2 === 0 ? "x" : " "}] Task item ${index}`
		return `Paragraph ${index} with **bold**, _emphasis_, #tag-${index % 17}, and [[Backlink ${index % 41}]].`
	})
	return `---
title: Large render fixture
tags:
  - benchmark
---

	${blocks.join("\n\n")}`
}

function createRepeatedDocument(
	blockCount: number,
	createBlock: (index: number) => string,
): string {
	return Array.from({ length: blockCount }, (_, index) => createBlock(index)).join("\n\n")
}

async function runRendererBenchmarks(config: ScaleConfig): Promise<TimedMeasurement[]> {
	const renderer = createRenderer({ surface: "reading-view" })
	const plainDocument = createRepeatedDocument(
		config.renderBlockCount,
		(index) => `Paragraph ${index} with ordinary prose and punctuation.`,
	)
	const mixedDocument = createRenderDocument(config.renderBlockCount)
	const denseTableDocument = createRepeatedDocument(
		Math.floor(config.renderBlockCount / 4),
		(index) => `| A | B | C | D |
| --- | --- | --- | --- |
| ${index} | **bold** | [link](https://example.com) | [[Wiki ${index}]] |`,
	)
	const calloutHeavyDocument = createRepeatedDocument(
		Math.floor(config.renderBlockCount / 4),
		(index) => `> [!tip]+ Callout ${index}
> Body with **bold** text and [link](https://example.com/${index}).`,
	)
	const wikiLinkHeavyDocument = createRepeatedDocument(
		config.renderBlockCount,
		(index) => `Paragraph ${index} with [[Wiki ${index}]] and [[Target ${index}|Label ${index}]].`,
	)
	const taskHeavyDocument = createRepeatedDocument(
		config.renderBlockCount,
		(index) => `- [${index % 2 === 0 ? "x" : " "}] Task item ${index} with trailing text.`,
	)
	const codeHeavyDocument = createRepeatedDocument(
		Math.max(1, Math.floor(config.renderBlockCount / 20)),
		(index) => `\`\`\`ts
export const value${index} = ${index}
export function compute${index}() {
	return value${index} * 2
}
\`\`\``,
	)

	const measurements: TimedMeasurement[] = []
	for (const [scenario, content] of [
		["plain-large-note", plainDocument],
		["mixed-large-note", mixedDocument],
		["table-heavy-note", denseTableDocument],
		["callout-heavy-note", calloutHeavyDocument],
		["wikilink-heavy-note", wikiLinkHeavyDocument],
		["task-heavy-note", taskHeavyDocument],
		["code-heavy-note", codeHeavyDocument],
	] as const) {
		measurements.push(
			await measure(
				"renderer",
				scenario,
				"render markdown to sanitized html",
				config.renderIterations,
				{ characters: content.length },
				async () => {
					const html = await renderer.render(content)
					blackhole += html.length
				},
			),
		)
	}
	return measurements
}

function formatNumber(value: number): string {
	return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function printMeasurements(measurements: TimedMeasurement[]): void {
	const rows = measurements.map((measurement) => ({
		workload: measurement.workload,
		scenario: measurement.scenario,
		metric: measurement.metric,
		p50: `${formatNumber(measurement.p50)}ms`,
		p95: `${formatNumber(measurement.p95)}ms`,
		heap: `${formatNumber(measurement.heapDeltaMb)}MB`,
		signal: measurement.signal,
	}))
	console.table(rows)
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const config = scaleConfigs[args.scale]
	const measurements: TimedMeasurement[] = []
	const startedAt = new Date().toISOString()

	console.log(`Large vault workbench: scale=${args.scale}`)
	console.log("Signals are review hints, not pass/fail claims.")

	if (args.only.has("file-tree")) measurements.push(...(await runFileTreeBenchmarks(config)))
	if (args.only.has("search")) measurements.push(...(await runSearchBenchmarks(config)))
	if (args.only.has("renderer")) measurements.push(...(await runRendererBenchmarks(config)))

	printMeasurements(measurements)
	console.log(`blackhole=${blackhole}`)

	if (args.jsonPath) {
		await writeFile(
			args.jsonPath,
			JSON.stringify(
				{
					startedAt,
					scale: args.scale,
					config,
					measurements,
				},
				null,
				2,
			),
		)
		console.log(`Wrote ${args.jsonPath}`)
	}
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
