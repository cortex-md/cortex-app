import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type FixtureScale = "smoke" | "roadmap"

interface ScaleConfig {
	notes: number
	folders: number
	bigNoteLines: number
	databaseRows: number
}

const FIXTURE_VERSION = 1
const WRITE_CONCURRENCY = 64

export const SCALES: Record<FixtureScale, ScaleConfig> = {
	smoke: { notes: 2_000, folders: 20, bigNoteLines: 1_000, databaseRows: 500 },
	roadmap: { notes: 50_000, folders: 100, bigNoteLines: 5_000, databaseRows: 10_000 },
}

export const FIXTURE_NOTES = {
	bigNote: "Perf big note",
	smallA: "Perf note A",
	smallB: "Perf note B",
	database: "Perf DB",
	rareTerm: "zephyrquartz",
	commonTerm: "orion",
	bigNoteMarker: "PERF-BIG-START",
} as const

export interface Fixture {
	path: string
	scale: FixtureScale
	config: ScaleConfig
}

const WORDS = [
	"orion",
	"lattice",
	"harbor",
	"meridian",
	"cobalt",
	"fern",
	"quill",
	"vector",
	"ember",
	"tundra",
	"signal",
	"canopy",
]

function paragraph(seed: number, length: number): string {
	const words: string[] = []
	for (let index = 0; index < length; index++) words.push(WORDS[(seed * 7 + index * 3) % WORDS.length])
	return words.join(" ")
}

function noteContent(index: number): string {
	const rare = index % 1_000 === 0 ? ` ${FIXTURE_NOTES.rareTerm}` : ""
	return [
		"---",
		`tags: [${WORDS[index % WORDS.length]}, batch-${index % 25}]`,
		`created: 2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
		"---",
		`# Note ${index}`,
		"",
		`${paragraph(index, 40)}${rare}`,
		"",
		`- [ ] Follow up on [[Note ${(index + 1) % 50_000}]]`,
		`- ${paragraph(index + 1, 12)}`,
		"",
		`## Details ${index}`,
		"",
		paragraph(index + 2, 60),
		"",
	].join("\n")
}

export function bigNoteContent(lines: number): string {
	const output = [`# ${FIXTURE_NOTES.bigNote}`, "", FIXTURE_NOTES.bigNoteMarker, ""]
	for (let index = 0; output.length < lines; index++) {
		if (index % 40 === 0) output.push(`## Section ${index / 40}`, "")
		else if (index % 13 === 0) output.push("```ts", `const value${index} = ${index}`, "```")
		else if (index % 5 === 0) output.push(`- ${paragraph(index, 10)} [[Note ${index}]] #${WORDS[index % 12]}`)
		else output.push(paragraph(index, 18))
	}
	return `${output.slice(0, lines).join("\n")}\n`
}

function databaseRow(index: number): string {
	const status = ["Backlog", "Active", "Review", "Done"][index % 4]
	return [
		"---",
		`status: ${status}`,
		`estimate: ${(index % 13) + 1}`,
		`owner: ${WORDS[index % WORDS.length]}`,
		"---",
		paragraph(index, 20),
		"",
	].join("\n")
}

async function writeAll(entries: Iterable<[string, string]>): Promise<void> {
	const iterator = entries[Symbol.iterator]()
	const worker = async () => {
		for (let next = iterator.next(); !next.done; next = iterator.next()) {
			await writeFile(next.value[0], next.value[1])
		}
	}
	await Promise.all(Array.from({ length: WRITE_CONCURRENCY }, worker))
}

function* noteEntries(root: string, config: ScaleConfig): Generator<[string, string]> {
	for (let index = 0; index < config.notes; index++) {
		yield [join(root, `Folder ${index % config.folders}`, `Note ${index}.md`), noteContent(index)]
	}
	const databaseFolder = join(root, FIXTURE_NOTES.database)
	for (let index = 0; index < config.databaseRows; index++) {
		yield [join(databaseFolder, `Row ${index}.md`), databaseRow(index)]
	}
}

async function exists(path: string): Promise<boolean> {
	return stat(path).then(
		() => true,
		() => false,
	)
}

export async function resetMutableNotes(fixture: Fixture): Promise<void> {
	await Promise.all([
		rm(join(fixture.path, ".cortex/workspace.json"), { force: true }),
		writeFile(
			join(fixture.path, `${FIXTURE_NOTES.bigNote}.md`),
			bigNoteContent(fixture.config.bigNoteLines),
		),
		writeFile(join(fixture.path, `${FIXTURE_NOTES.smallA}.md`), "# Perf note A\n\nPERF-NOTE-A\n"),
		writeFile(join(fixture.path, `${FIXTURE_NOTES.smallB}.md`), "# Perf note B\n\nPERF-NOTE-B\n"),
	])
}

export async function ensureFixture(scale: FixtureScale, root?: string): Promise<Fixture> {
	const config = SCALES[scale]
	const path = root ?? join(tmpdir(), "cortex-perf", `${scale}-v${FIXTURE_VERSION}`)
	const fixture = { path, scale, config }
	const readyMarker = join(path, ".cortex-perf-ready")
	if (!(await exists(readyMarker))) {
		const started = performance.now()
		await rm(path, { recursive: true, force: true })
		const folders = Array.from({ length: config.folders }, (_, index) => join(path, `Folder ${index}`))
		await Promise.all(
			[...folders, join(path, FIXTURE_NOTES.database)].map((folder) =>
				mkdir(folder, { recursive: true }),
			),
		)
		await writeFile(
			join(path, FIXTURE_NOTES.database, `${FIXTURE_NOTES.database}.md`),
			"---\ndatabase:\n  version: 1\n  views:\n    - id: table\n      type: table\n      name: Table\n---\n",
		)
		await writeAll(noteEntries(path, config))
		await writeFile(readyMarker, `${Date.now()}\n`)
		console.log(
			`Generated ${scale} fixture (${config.notes + config.databaseRows} notes) in ${Math.round(performance.now() - started)} ms`,
		)
	}
	await resetMutableNotes(fixture)
	return fixture
}
