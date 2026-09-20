import { vi, type Mock } from "vitest"
import type { CortexBridge } from "../bridge"

export const cortexBridgeMock: {
	invoke: Mock<CortexBridge["invoke"]>
	on: Mock<CortexBridge["on"]>
} = {
	invoke: vi.fn(),
	on: vi.fn(),
}

export function installCortexBridgeMock() {
	Object.defineProperty(window, "cortex", {
		configurable: true,
		value: {
			invoke: cortexBridgeMock.invoke,
			on: cortexBridgeMock.on,
		},
	})
}

export function resetCortexBridgeMock() {
	cortexBridgeMock.invoke.mockReset()
	cortexBridgeMock.on.mockReset()
	cortexBridgeMock.on.mockReturnValue(() => {})
}
