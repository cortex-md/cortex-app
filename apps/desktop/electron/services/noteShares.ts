import { createNoteSharesService } from "@cortex/sync-api"
import { secrets, serverApi } from "./serverApi"
import { shareCrypto } from "./shareCrypto"

export const noteSharesApi = createNoteSharesService({
	secrets,
	client: () => serverApi.client(),
	crypto: shareCrypto,
})
