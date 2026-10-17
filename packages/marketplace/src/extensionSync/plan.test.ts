import { describe, expect, it } from "vitest"
import {
	deriveManifest,
	type LocalExtension,
	type LocalExtensionView,
	parseManifestItems,
	planReconcile,
	type SyncedExtension,
	serializeManifest,
} from "./plan"

function view(items: LocalExtension[], communityVisible = true): LocalExtensionView {
	return { items, communityVisible }
}

function community(id: string, version: string, enabled = false): LocalExtension {
	return { id, version, enabled, community: true }
}

describe("planReconcile", () => {
	it("installs missing items, updates older ones and never downgrades", () => {
		const remote: SyncedExtension[] = [
			{ id: "a", version: "1.0.0", enabled: false },
			{ id: "b", version: "2.0.0", enabled: false },
			{ id: "c", version: "1.0.0", enabled: false },
		]
		const plan = planReconcile(
			"plugins",
			remote,
			view([community("b", "1.5.0"), community("c", "3.0.0")]),
			{ known: [] },
		)
		expect(plan.install.map((item) => item.id)).toEqual(["a"])
		expect(plan.update.map((item) => item.id)).toEqual(["b"])
		expect(plan.uninstall).toEqual([])
	})

	it("uninstalls only items removed remotely after this device synced them", () => {
		const plan = planReconcile(
			"plugins",
			[],
			view([community("synced", "1.0.0"), community("local-only", "1.0.0")]),
			{ known: ["synced"] },
		)
		expect(plan.uninstall).toEqual(["synced"])
	})

	it("needs approval before enabling a community plugin this device never enabled", () => {
		const remote: SyncedExtension[] = [
			{ id: "new", version: "1.0.0", enabled: true },
			{ id: "approved", version: "1.0.0", enabled: true },
			{ id: "bundled", version: null, enabled: true, bundled: true },
		]
		const plan = planReconcile(
			"plugins",
			remote,
			view([
				community("approved", "1.0.0"),
				{ id: "bundled", version: "0.1.1", enabled: false, community: false },
			]),
			{ known: ["approved"], approved: ["approved"] },
		)
		expect(plan.install.map((item) => item.id)).toEqual(["new"])
		expect(plan.awaitingApproval).toEqual(["new"])
		expect(plan.enable.sort()).toEqual(["approved", "bundled"])
	})

	it("keeps community plugins untouched while community plugins are off", () => {
		const plan = planReconcile(
			"plugins",
			[{ id: "remote", version: "1.0.0", enabled: true }],
			view([], false),
			{ known: ["hidden"] },
		)
		expect(plan.install).toEqual([])
		expect(plan.uninstall).toEqual([])
		expect(plan.communityOff).toEqual(["remote"])
	})

	it("reports bundled plugins this app does not have as unavailable", () => {
		const plan = planReconcile(
			"plugins",
			[{ id: "future", version: null, enabled: true, bundled: true }],
			view([]),
			{ known: [] },
		)
		expect(plan.install).toEqual([])
		expect(plan.unavailable).toEqual(["future"])
	})
})

describe("deriveManifest", () => {
	it("merges local-only items with remote items not yet applied here", () => {
		const derived = deriveManifest(
			"themes",
			[{ id: "remote-pending", version: "1.0.0" }],
			view([community("local", "2.0.0")]),
			{ known: [] },
		)
		expect(derived.items.map((item) => item.id)).toEqual(["local", "remote-pending"])
		expect(derived.known).toEqual(["local"])
	})

	it("drops items uninstalled on this device", () => {
		const derived = deriveManifest(
			"themes",
			[
				{ id: "kept", version: "1.0.0" },
				{ id: "removed", version: "1.0.0" },
			],
			view([community("kept", "1.0.0")]),
			{ known: ["kept", "removed"] },
		)
		expect(derived.items.map((item) => item.id)).toEqual(["kept"])
	})

	it("carries community plugins while they are hidden by restricted mode", () => {
		const current: SyncedExtension[] = [
			{ id: "community", version: "1.0.0", enabled: true },
			{ id: "core", version: null, enabled: true, bundled: true },
		]
		const derived = deriveManifest(
			"plugins",
			current,
			view([{ id: "core", version: "0.1.1", enabled: true, community: false }], false),
			{ known: ["community"] },
		)
		expect(derived.items.find((item) => item.id === "community")).toEqual(current[0])
		expect(derived.known).toEqual(["community"])
	})

	it("records community plugins enabled on this device as approved", () => {
		const derived = deriveManifest(
			"plugins",
			null,
			view([community("on", "1.0.0", true), community("off", "1.0.0")]),
			{ known: [], approved: [] },
		)
		expect(derived.approved).toEqual(["on"])
	})

	it("is stable, so an unchanged state never rewrites the manifest", () => {
		const local = view([community("b", "1.0.0", true), community("a", "2.0.0")])
		const first = deriveManifest("plugins", null, local, { known: [] })
		const second = deriveManifest("plugins", first.items, local, {
			known: first.known,
			approved: first.approved,
		})
		const reparsed = parseManifestItems(
			"plugins",
			JSON.parse(serializeManifest("plugins", first.items)) as Record<string, unknown>,
		)
		expect(serializeManifest("plugins", second.items)).toBe(
			serializeManifest("plugins", first.items),
		)
		expect(serializeManifest("plugins", reparsed)).toBe(serializeManifest("plugins", first.items))
		expect(first.items.map((item) => item.id)).toEqual(["a", "b"])
	})

	it("converges after a reconcile instead of ping-ponging", () => {
		const remote: SyncedExtension[] = [{ id: "x", version: "1.0.0", enabled: false }]
		const local = view([community("x", "1.0.0")])
		const plan = planReconcile("plugins", remote, local, { known: ["x"] })
		const derived = deriveManifest("plugins", remote, local, { known: ["x"] })
		expect(plan.install.length + plan.update.length + plan.uninstall.length).toBe(0)
		expect(serializeManifest("plugins", derived.items)).toBe(serializeManifest("plugins", remote))
	})
})
