import { generateKeyPairSync } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const outIndex = process.argv.indexOf("--out")
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : null

const { publicKey, privateKey } = generateKeyPairSync("ed25519")
const publicBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64")
const privateBase64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64")

console.log("Public key (paste into apps/desktop/electron/updates/publicKey.ts):")
console.log(publicBase64)

if (outDir) {
	await mkdir(outDir, { recursive: true, mode: 0o700 })
	await writeFile(join(outDir, "cortex-update.key"), `${privateBase64}\n`, { mode: 0o600, flag: "wx" })
	await writeFile(join(outDir, "cortex-update.pub"), `${publicBase64}\n`, { flag: "wx" })
	console.log(`\nPrivate key written to ${join(outDir, "cortex-update.key")} (mode 600).`)
} else {
	console.log("\nPrivate key (store as the CORTEX_UPDATE_PRIVATE_KEY secret, never commit it):")
	console.log(privateBase64)
}
console.log("\nGenerate the pair once. Replacing it means every installed build stops accepting updates.")
