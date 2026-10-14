import { createTemplateSharesService } from "@cortex/sync-api"
import { secrets, serverApi } from "./serverApi"
import { shareCrypto } from "./shareCrypto"

export const templateSharesApi = createTemplateSharesService({
	secrets,
	client: () => serverApi.client(),
	crypto: shareCrypto,
})
