import { execFile, spawn } from "node:child_process"
import { constants } from "node:fs"
import { access } from "node:fs/promises"
import { promisify } from "node:util"
import { UpdateError } from "../errors"

export const execFileAsync = promisify(execFile)

export function spawnDetached(command: string, args: readonly string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: false })
		child.once("error", (error) =>
			reject(new UpdateError("INSTALL_FAILED", `Could not start the installer: ${error.message}`)),
		)
		child.once("spawn", () => {
			child.unref()
			resolve()
		})
	})
}

export async function isWritable(path: string): Promise<boolean> {
	try {
		await access(path, constants.W_OK)
		return true
	} catch {
		return false
	}
}

export async function assertWritable(paths: readonly string[]): Promise<void> {
	const results = await Promise.all(paths.map(isWritable))
	const blocked = paths.find((_, index) => !results[index])
	if (blocked) {
		throw new UpdateError("NO_WRITE_PERMISSION", `Cortex cannot write to ${blocked}`)
	}
}
