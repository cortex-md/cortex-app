import type { EffectiveAccess, EffectiveAccessLevel } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { type AccessEvaluator, createAccessEvaluator } from "../sync/access"
import { getCurrentVaultPath } from "./vaultRuntime"

export interface AccessState {
	access: EffectiveAccess | null
	accessVaultPath: string | null
	evaluator: AccessEvaluator

	setAccess: (access: EffectiveAccess | null) => void
	resetAccess: () => void
	loadAccess: () => Promise<void>
	levelForPath: (relativePath: string, isDirectory?: boolean) => EffectiveAccessLevel
	canReadPath: (relativePath: string, isDirectory?: boolean) => boolean
	canWritePath: (relativePath: string, isDirectory?: boolean) => boolean
}

export const useAccessStore = create<AccessState>()(
	devtools(
		(set, get) => ({
			access: null,
			accessVaultPath: null,
			evaluator: createAccessEvaluator(null),

			setAccess: (access) => {
				const vaultPath = getCurrentVaultPath()
				const current = get()
				if (access === current.access) return
				const keepLastKnown =
					access === null && current.access !== null && current.accessVaultPath === vaultPath
				if (keepLastKnown) return
				set({ access, accessVaultPath: vaultPath, evaluator: createAccessEvaluator(access) })
			},

			resetAccess: () => {
				set({ access: null, accessVaultPath: null, evaluator: createAccessEvaluator(null) })
			},

			loadAccess: async () => {
				try {
					get().setAccess(await getPlatform().sync.getAccess())
				} catch {
					get().setAccess(null)
				}
			},

			levelForPath: (relativePath, isDirectory) =>
				get().evaluator.levelOf(relativePath, isDirectory),
			canReadPath: (relativePath, isDirectory) =>
				get().evaluator.canRead(relativePath, isDirectory),
			canWritePath: (relativePath, isDirectory) =>
				get().evaluator.canWrite(relativePath, isDirectory),
		}),
		{ name: "accessStore" },
	),
)

function toRelative(absolutePath: string, vaultPath: string | null): string | null {
	if (!vaultPath) return null
	if (absolutePath === vaultPath) return ""
	return toVaultRelativePath(absolutePath, vaultPath)
}

export function canWriteVaultPath(
	absolutePath: string,
	isDirectory = false,
	evaluator: AccessEvaluator = useAccessStore.getState().evaluator,
	vaultPath: string | null = getCurrentVaultPath(),
): boolean {
	if (!evaluator.restricted) return true
	const relativePath = toRelative(absolutePath, vaultPath)
	if (relativePath === null) return true
	return evaluator.canWrite(relativePath, isDirectory || relativePath === "")
}

export function canReadVaultPath(
	absolutePath: string,
	isDirectory = false,
	evaluator: AccessEvaluator = useAccessStore.getState().evaluator,
	vaultPath: string | null = getCurrentVaultPath(),
): boolean {
	if (!evaluator.restricted) return true
	const relativePath = toRelative(absolutePath, vaultPath)
	if (relativePath === null) return true
	return evaluator.canRead(relativePath, isDirectory || relativePath === "")
}

export function canWriteVaultTree(
	absolutePath: string,
	isDirectory: boolean,
	evaluator: AccessEvaluator = useAccessStore.getState().evaluator,
	vaultPath: string | null = getCurrentVaultPath(),
): boolean {
	if (!evaluator.restricted) return true
	const relativePath = toRelative(absolutePath, vaultPath)
	if (relativePath === null) return true
	return evaluator.canWriteTree(relativePath, isDirectory || relativePath === "")
}

export function assertVaultPathWritable(absolutePath: string, isDirectory = false): void {
	if (canWriteVaultPath(absolutePath, isDirectory)) return
	throw new Error("You only have view access here. Ask a vault admin for edit access.")
}

export function assertVaultTreeWritable(absolutePath: string, isDirectory: boolean): void {
	if (canWriteVaultTree(absolutePath, isDirectory)) return
	throw new Error(
		"You only have view access to part of this item. Ask a vault admin for edit access.",
	)
}
