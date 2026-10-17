import { createVaultKeyFlow, type VaultKeyFlowOptions } from "@cortex/core"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

export type { VaultKeyFlow, VaultKeyFlowOptions } from "@cortex/core"

export function useVaultKeyFlow(options: VaultKeyFlowOptions) {
	const optionsRef = useRef(options)
	useLayoutEffect(() => {
		optionsRef.current = options
	})
	const [flow] = useState(() => createVaultKeyFlow(() => optionsRef.current))

	useEffect(() => {
		flow.startUnlockCheck()
	}, [flow])

	return flow
}
