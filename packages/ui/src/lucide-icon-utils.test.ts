import { describe, expect, it } from "vitest"
import { isValidLucideIconName, resolveLucideIconName } from "./lucide-icon-utils"

describe("lucide icon utilities", () => {
	it("resolves kebab-case and component-style names without importing icon components", () => {
		expect(resolveLucideIconName("search")).toBe("search")
		expect(resolveLucideIconName("FolderOpen")).toBe("folder-open")
		expect(resolveLucideIconName("FolderOpenIcon")).toBe("folder-open")
		expect(isValidLucideIconName("not-a-real-icon")).toBe(false)
	})
})
