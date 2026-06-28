import { describe, expect, it } from "vitest"

import {
	createMobileVaultLogicalPath,
	getMobileVaultPathParts,
	getMobileVaultRelativePath,
	isHiddenMobileVaultPath,
	isMobileVaultLogicalPath,
	joinMobileVaultPath,
	normalizeMobileVaultPath,
} from "../mobile-vault-paths"

describe("mobile vault logical paths", () => {
	it("normalizes duplicate and trailing slashes", () => {
		expect(normalizeMobileVaultPath("//mobile-vaults//abc//Notes//")).toBe(
			"/mobile-vaults/abc/Notes",
		)
	})

	it("creates and recognizes logical vault paths", () => {
		const path = createMobileVaultLogicalPath("vault-1")
		expect(path).toBe("/mobile-vaults/vault-1")
		expect(isMobileVaultLogicalPath(path)).toBe(true)
		expect(isMobileVaultLogicalPath("/Users/me/Documents")).toBe(false)
	})

	it("extracts root id and child path", () => {
		expect(getMobileVaultPathParts("/mobile-vaults/vault-1/Folder/Note.md")).toEqual({
			relativePath: "Folder/Note.md",
			rootId: "vault-1",
		})
	})

	it("derives child paths relative to the logical root", () => {
		expect(
			getMobileVaultRelativePath("/mobile-vaults/vault-1/Folder/Note.md", "/mobile-vaults/vault-1"),
		).toBe("Folder/Note.md")
		expect(joinMobileVaultPath("/mobile-vaults/vault-1/Folder", "Note.md")).toBe(
			"/mobile-vaults/vault-1/Folder/Note.md",
		)
	})

	it("detects hidden paths before they enter vault scans", () => {
		expect(isHiddenMobileVaultPath("/mobile-vaults/vault-1/.cortex/vault-id.json")).toBe(true)
		expect(isHiddenMobileVaultPath("/mobile-vaults/vault-1/Notes/Today.md")).toBe(false)
	})
})
