export function parseCsvRecords(content: string): string[][] {
	const records: string[][] = []
	let record: string[] = []
	let field = ""
	let quoted = false

	for (let index = 0; index < content.length; index += 1) {
		const char = content[index]
		const next = content[index + 1]

		if (quoted) {
			if (char === "\"" && next === "\"") {
				field += "\""
				index += 1
			} else if (char === "\"") {
				quoted = false
			} else {
				field += char
			}
			continue
		}

		if (char === "\"") {
			quoted = true
		} else if (char === ",") {
			record.push(field)
			field = ""
		} else if (char === "\n") {
			record.push(field)
			records.push(record)
			record = []
			field = ""
		} else if (char !== "\r") {
			field += char
		}
	}

	if (field.length > 0 || record.length > 0) {
		record.push(field)
		records.push(record)
	}

	return records
}

export function stringifyCsvRecords(records: string[][]): string {
	return records
		.map((record) =>
			record
				.map((field) => {
					if (!/[",\n\r]/u.test(field)) return field
					return `"${field.replaceAll("\"", "\"\"")}"`
				})
				.join(","),
		)
		.join("\n")
}

export function csvRecordsToMarkdownTable(records: string[][]): string {
	if (records.length === 0) return ""
	const width = Math.max(...records.map((record) => record.length), 1)
	const rows = records.map((record) =>
		Array.from({ length: width }, (_, index) => record[index]?.trim() ?? ""),
	)
	const [header, ...body] = rows
	const tableRows = [
		`| ${header.map(escapeMarkdownTableCell).join(" | ")} |`,
		`| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
		...body.map((row) => `| ${row.map(escapeMarkdownTableCell).join(" | ")} |`),
	]
	return tableRows.join("\n")
}

export function extractFirstMarkdownTable(markdown: string): string[][] | null {
	const lines = markdown.split(/\r?\n/u)
	for (let index = 0; index < lines.length - 1; index += 1) {
		const header = parseMarkdownTableLine(lines[index])
		const delimiter = parseMarkdownTableLine(lines[index + 1])
		if (!header || !delimiter || !delimiter.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()))) {
			continue
		}

		const rows = [header]
		for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
			const row = parseMarkdownTableLine(lines[rowIndex])
			if (!row) break
			rows.push(row)
		}
		return rows
	}
	return null
}

function parseMarkdownTableLine(line: string): string[] | null {
	const trimmed = line.trim()
	if (!trimmed.includes("|")) return null
	const withoutEdges = trimmed.replace(/^\|/u, "").replace(/\|$/u, "")
	return withoutEdges.split("|").map((cell) => cell.trim().replaceAll("\\|", "|"))
}

function escapeMarkdownTableCell(value: string): string {
	return value.replaceAll("|", "\\|").replace(/\r?\n/gu, " ")
}

