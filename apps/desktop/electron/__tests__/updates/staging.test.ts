import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	appImageUpdatePath,
	cleanStaging,
	newestStagedVersion,
	readPreparedPackage,
	type StagingLayout,
	writePreparedMarker,
} from "../../updates/staging"

let root: string
let layout: StagingLayout

async function touch(path: string): Promise<void> {
	await mkdir(join(path, ".."), { recursive: true })
	await writeFile(path, "x")
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "cortex-staging-"))
	layout = {
		root: join(root, "userData", "updates"),
		appImagePath: join(root, "Apps", "Cortex.AppImage"),
		macBundlePath: join(root, "Applications", "Cortex.app"),
	}
})

afterEach(async () => {
	await rm(root, { recursive: true, force: true })
})

describe("update staging cleanup", () => {
	it("removes every staged version except the one kept", async () => {
		await touch(join(layout.root, "1.3.0", "Cortex.zip"))
		await touch(join(layout.root, "1.4.0", "Cortex.zip.part"))
		await touch(join(layout.root, "1.5.0", "prepared.json"))
		await cleanStaging(layout, "1.5.0")
		expect(await readdir(layout.root)).toEqual(["1.5.0"])
	})

	it("removes the staging folder itself once nothing is kept", async () => {
		await touch(join(layout.root, "1.4.0", "install.log"))
		await cleanStaging(layout, null)
		expect(existsSync(layout.root)).toBe(false)
	})

	it("removes only Cortex's own AppImage leftovers next to the running file", async () => {
		const appImage = layout.appImagePath as string
		await touch(appImage)
		await touch(appImageUpdatePath(appImage, "1.4.0"))
		await touch(`${appImageUpdatePath(appImage, "1.4.1")}.part`)
		await touch(appImageUpdatePath(appImage, "1.5.0"))
		await touch(join(root, "Apps", "Other.AppImage"))
		await touch(join(root, "Apps", ".Other.AppImage.1.4.0.update"))
		await cleanStaging(layout, "1.5.0")
		expect((await readdir(join(root, "Apps"))).sort()).toEqual([
			".Cortex.AppImage.1.5.0.update",
			".Other.AppImage.1.4.0.update",
			"Cortex.AppImage",
			"Other.AppImage",
		])
	})

	it("removes a backup bundle left by an interrupted macOS install", async () => {
		await touch(join(root, "Applications", "Cortex.app", "Contents", "Info.plist"))
		await touch(join(root, "Applications", ".Cortex.app.backup", "Contents", "Info.plist"))
		await cleanStaging(layout, null)
		expect(await readdir(join(root, "Applications"))).toEqual(["Cortex.app"])
	})

	it("works when nothing was ever staged", async () => {
		await expect(cleanStaging(layout, null)).resolves.toEqual([])
	})

	it("keeps the newest pending download across restarts", async () => {
		await mkdir(join(layout.root, "1.2.0"), { recursive: true })
		await mkdir(join(layout.root, "1.5.0-beta.1"), { recursive: true })
		await mkdir(join(layout.root, "1.4.0"), { recursive: true })
		await mkdir(join(layout.root, "garbage"), { recursive: true })
		expect(await newestStagedVersion(layout, "1.3.0")).toBe("1.5.0-beta.1")
		expect(await newestStagedVersion(layout, "1.6.0")).toBeNull()
	})
})

describe("prepared package marker", () => {
	const entry = { type: "zip" as const, url: "https://x", sha256: "a".repeat(64), size: 10 }

	it("reuses a prepared package only while it matches and still exists", async () => {
		const stagingDir = join(layout.root, "1.4.0")
		const preparedPath = join(stagingDir, "extracted", "Cortex.app")
		await mkdir(preparedPath, { recursive: true })
		await writePreparedMarker(stagingDir, { version: "1.4.0", ...entry, preparedPath })

		expect(await readPreparedPackage(stagingDir, "1.4.0", entry)).toBe(preparedPath)
		expect(await readPreparedPackage(stagingDir, "1.4.1", entry)).toBeNull()
		expect(
			await readPreparedPackage(stagingDir, "1.4.0", { ...entry, sha256: "b".repeat(64) }),
		).toBeNull()
		await rm(preparedPath, { recursive: true })
		expect(await readPreparedPackage(stagingDir, "1.4.0", entry)).toBeNull()
	})

	it("ignores a missing or corrupt marker", async () => {
		const stagingDir = join(layout.root, "1.4.0")
		expect(await readPreparedPackage(stagingDir, "1.4.0", entry)).toBeNull()
		await touch(join(stagingDir, "prepared.json"))
		expect(await readPreparedPackage(stagingDir, "1.4.0", entry)).toBeNull()
	})
})
