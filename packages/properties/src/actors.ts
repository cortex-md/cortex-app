import type { PropertyAuthorContext, ResolvedAuthorConfig, ResolvedPropertyActor } from "./types"

export function resolveAuthorConfig(context: PropertyAuthorContext): ResolvedAuthorConfig {
	if (!context.authenticated || !context.remoteVaultId) return { variant: "text" }
	return {
		variant: "person",
		options: context.members,
		currentUserId: context.currentUserId,
	}
}

export function resolveCurrentPropertyActor(context: PropertyAuthorContext): string {
	if (context.authenticated && context.remoteVaultId && context.currentUserId) {
		return context.currentUserId
	}
	return `device:${context.currentDeviceId}`
}

export function resolvePropertyActorValue(
	context: PropertyAuthorContext,
	value: unknown,
): ResolvedPropertyActor {
	const id = String(value ?? "")
	const person = context.members.find((member) => member.id === id)
	if (person) {
		return {
			kind: "person",
			...person,
			current: person.id === context.currentUserId,
		}
	}
	const deviceId = id.startsWith("device:") ? id.slice("device:".length) : id
	const device = context.devices.find((candidate) => candidate.id === deviceId)
	if (device || id.startsWith("device:")) {
		return {
			kind: "device",
			id,
			label:
				device?.label ?? (deviceId === context.currentDeviceId ? "This device" : "Local device"),
			current: device?.current ?? deviceId === context.currentDeviceId,
		}
	}
	return {
		kind: "unknown",
		id,
		label: "Unknown member",
	}
}
