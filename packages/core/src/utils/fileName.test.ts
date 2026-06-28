import { describe, expect, it } from "vitest"
import { getNotePathPresentation, getNoteTitleError, getPortableFileNameError } from "./fileName"

describe("getNotePathPresentation", () => {
	it("returns the path relative to the vault without the markdown extension", () => {
		expect(getNotePathPresentation("/vault/folder/Current.md", "/vault")).toEqual({
			title: "Current",
			segments: [
				{ id: "folder", label: "folder" },
				{ id: "folder/Current", label: "Current" },
			],
		})
	})

	it("supports Windows paths and uppercase markdown extensions", () => {
		expect(getNotePathPresentation("C:\\Vault\\Folder\\Current.MD", "C:\\Vault")).toEqual({
			title: "Current",
			segments: [
				{ id: "Folder", label: "Folder" },
				{ id: "Folder/Current", label: "Current" },
			],
		})
	})

	it("falls back to the note name when the file is outside the vault", () => {
		expect(getNotePathPresentation("/other/folder/Current.md", "/vault")).toEqual({
			title: "Current",
			segments: [{ id: "Current", label: "Current" }],
		})
	})
})

describe("getPortableFileNameError", () => {
	it.each([
		"",
		" ",
		".",
		"..",
		"CON.md",
		"name.",
		"name ",
		"folder/note.md",
		"note?.md",
	])("rejects non-portable file name %j", (fileName) => {
		expect(getPortableFileNameError(fileName)).not.toBeNull()
	})

	it.each([
		"Note.md",
		"My note.md",
		"daily.2026-06-12.md",
	])("accepts portable file name %j", (fileName) => {
		expect(getPortableFileNameError(fileName)).toBeNull()
	})
})

describe("getNoteTitleError", () => {
	it("rejects empty and invalid note titles", () => {
		expect(getNoteTitleError("  ")).toBe("File name cannot be empty")
		expect(getNoteTitleError("invalid/name")).not.toBeNull()
	})

	it("accepts a portable title without an extension", () => {
		expect(getNoteTitleError("Current note")).toBeNull()
	})
})
