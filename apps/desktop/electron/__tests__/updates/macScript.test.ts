import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { buildMacInstallScript, shellQuote } from "../../updates/installers/macScript"

let root: string

async function createBundle(path: string, marker: string, withExecutable = true): Promise<void> {
	await mkdir(join(path, "Contents", "MacOS"), { recursive: true })
	await writeFile(join(path, "Contents", "marker.txt"), marker)
	if (withExecutable) {
		const executable = join(path, "Contents", "MacOS", "Cortex")
		await writeFile(executable, "#!/bin/sh\n")
		await chmod(executable, 0o755)
	}
}

function exitedPid(): Promise<number> {
	return new Promise((resolve) => {
		const child = spawn("/bin/sh", ["-c", "exit 0"])
		child.once("exit", () => resolve(child.pid ?? 0))
	})
}

function runScript(script: string): Promise<number> {
	return new Promise((resolve) => {
		const child = spawn("/bin/sh", ["-c", script])
		child.once("exit", (code) => resolve(code ?? -1))
	})
}

async function scriptFor(newAppPath: string) {
	return buildMacInstallScript({
		pid: await exitedPid(),
		currentAppPath: join(root, "Applications", "Cortex.app"),
		newAppPath,
		backupAppPath: join(root, "Applications", ".Cortex.app.backup"),
		logPath: join(root, "install.log"),
		executableName: "Cortex",
		relaunchCommand: "true",
		waitTimeoutSeconds: 5,
	})
}

describe.skipIf(process.platform === "win32")("macOS install script", () => {
	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "cortex's update "))
		await createBundle(join(root, "Applications", "Cortex.app"), "old")
	})

	afterEach(async () => {
		await rm(root, { recursive: true, force: true })
	})

	it("swaps the bundle and removes the backup", async () => {
		const newApp = join(root, "staging", "Cortex.app")
		await createBundle(newApp, "new")
		expect(await runScript(await scriptFor(newApp))).toBe(0)
		const current = join(root, "Applications", "Cortex.app")
		expect(await readFile(join(current, "Contents", "marker.txt"), "utf8")).toBe("new")
		expect(existsSync(join(root, "Applications", ".Cortex.app.backup"))).toBe(false)
		expect(existsSync(newApp)).toBe(false)
	})

	it("restores the previous bundle when the new one is incomplete", async () => {
		const newApp = join(root, "staging", "Cortex.app")
		await createBundle(newApp, "broken", false)
		expect(await runScript(await scriptFor(newApp))).toBe(1)
		const current = join(root, "Applications", "Cortex.app")
		expect(await readFile(join(current, "Contents", "marker.txt"), "utf8")).toBe("old")
		expect(existsSync(join(root, "Applications", ".Cortex.app.backup"))).toBe(false)
	})

	it("keeps the current bundle when the new one is missing", async () => {
		expect(await runScript(await scriptFor(join(root, "missing", "Cortex.app")))).toBe(1)
		const current = join(root, "Applications", "Cortex.app")
		expect(await readFile(join(current, "Contents", "marker.txt"), "utf8")).toBe("old")
	})

	it("waits for the running process before touching the bundle", async () => {
		const sleeper = spawn("/bin/sh", ["-c", "sleep 0.5"])
		const newApp = join(root, "staging", "Cortex.app")
		await createBundle(newApp, "new")
		const script = buildMacInstallScript({
			pid: sleeper.pid ?? 0,
			currentAppPath: join(root, "Applications", "Cortex.app"),
			newAppPath: newApp,
			backupAppPath: join(root, "Applications", ".Cortex.app.backup"),
			logPath: join(root, "install.log"),
			executableName: "Cortex",
			relaunchCommand: "true",
			waitTimeoutSeconds: 0,
		})
		expect(await runScript(script)).toBe(1)
		expect(
			await readFile(join(root, "Applications", "Cortex.app", "Contents", "marker.txt"), "utf8"),
		).toBe("old")
		sleeper.kill()
	})

	it("quotes paths with spaces and single quotes", () => {
		expect(shellQuote("/Users/Ana Maria/it's.app")).toBe(`'/Users/Ana Maria/it'\\''s.app'`)
	})
})
