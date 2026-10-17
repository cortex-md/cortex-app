import { findCodeLanguagePack } from "./languagePacks"

export async function getLanguageSupport(lang: string): Promise<unknown | null> {
	const pack = findCodeLanguagePack(lang)
	return pack ? await pack.load() : null
}
