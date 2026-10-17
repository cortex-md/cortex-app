import { resolveEntry } from "./pathResolver"

export async function resolveActualFileUri(path: string): Promise<string> {
	return (await resolveEntry(path)).entry.uri
}
