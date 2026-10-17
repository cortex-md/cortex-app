import { createNoteSharesService, createTemplateSharesService } from "@cortex/sync-api"

import { secrets } from "./keychain"
import { serverApi } from "./serverApi"
import { shareCrypto } from "./shareCrypto"

export const sharesApi = createNoteSharesService({
	secrets,
	client: () => serverApi.client(),
	crypto: shareCrypto,
})

export const templateSharesApi = createTemplateSharesService({
	secrets,
	client: () => serverApi.client(),
	crypto: shareCrypto,
})
