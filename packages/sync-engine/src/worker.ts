import { decodeVek } from "./crypto"
import { SyncEngine } from "./engine"
import {
	type FromWorkerMessage,
	type MainMethods,
	RpcChannel,
	respond,
	type SyncEventMessage,
	type ToWorkerMessage,
} from "./protocol"

interface ParentPortLike {
	on(event: "message", listener: (event: { data: unknown }) => void): void
	postMessage(message: unknown): void
}

const port = (process as NodeJS.Process & { parentPort?: ParentPortLike }).parentPort
if (!port) throw new Error("sync-engine worker must run inside an Electron UtilityProcess")

const post = (message: FromWorkerMessage) => port.postMessage(message)
const main = new RpcChannel<MainMethods>(post)
let deviceId = ""

const engine = new SyncEngine({
	deviceId: () => deviceId,
	emit: (name, payload) => post({ type: "event", name, payload } as SyncEventMessage),
	tokens: {
		getAccessToken: (serverUrl) => main.call("getAccessToken", { serverUrl }),
		refreshAccessToken: (serverUrl) => main.call("refreshAccessToken", { serverUrl }),
	},
	loadVek: async (vaultId) => {
		const encoded = await main.call("getVek", { vaultId })
		return encoded ? decodeVek(encoded) : null
	},
})

function reportFatal(label: string, error: unknown): void {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
	post({
		type: "event",
		name: "sync-log",
		payload: { level: "error", message: `Sync worker ${label}: ${message}` },
	} as SyncEventMessage)
}

process.on("uncaughtException", (error) => reportFatal("error", error))
process.on("unhandledRejection", (reason) => reportFatal("rejection", reason))

port.on("message", ({ data }) => {
	const message = data as ToWorkerMessage
	switch (message.type) {
		case "init":
			deviceId = message.deviceId
			return
		case "command":
			engine.dispatch(message.command)
			return
		case "request":
			void respond(message, (request) => engine.handleRequest(request), post)
			return
		case "response":
			main.settle(message)
			return
	}
})
