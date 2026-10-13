export const FIXTURE_REMOTE_EDIT_SUFFIX = " (edited on Ana’s MacBook Pro)"

export const FIXTURE_REMOTE_APPENDED_LINE = "Remote edit from another device."

export function createFixtureRemoteContent(local: string): string {
	const lines = local.split("\n")
	for (let index = lines.length - 1; index >= 0; index--) {
		const line = lines[index]?.trim() ?? ""
		if (line && !line.startsWith("#") && !line.startsWith("---")) {
			lines[index] = `${lines[index]}${FIXTURE_REMOTE_EDIT_SUFFIX}`
			return lines.join("\n")
		}
	}
	return `${local.replace(/\n*$/, "\n")}${FIXTURE_REMOTE_APPENDED_LINE}\n`
}
