import type { VaultImpact } from "./VaultImpactDialog"

export function forgetImpact(name: string, server: string): VaultImpact {
	return {
		title: `Remove ${name} from this list?`,
		description: "The folder stays where it is. Open it again any time.",
		cells: [
			{ where: "This Mac", what: "Folder stays", tone: "keep" },
			{ where: server, what: "Unchanged", tone: "keep" },
			{ where: "Other devices & members", what: "Unchanged", tone: "keep" },
		],
		confirmLabel: "Remove",
	}
}

export function unlinkImpact(name: string, remoteName: string, server: string): VaultImpact {
	return {
		title: `Stop syncing ${name}?`,
		description: "This Mac keeps every note as a local vault. You can link it again later.",
		cells: [
			{ where: "This Mac", what: "Becomes local only", tone: "stop" },
			{ where: server, what: `${remoteName} stays as is`, tone: "keep" },
			{ where: "Other devices", what: "Keep syncing", tone: "keep" },
		],
		confirmLabel: "Stop syncing",
	}
}

export function leaveImpact(name: string, server: string): VaultImpact {
	return {
		title: `Leave ${name}?`,
		description: "You need a new invite to come back.",
		cells: [
			{ where: "This Mac", what: "Nothing here", tone: "keep" },
			{ where: server, what: "Your access ends", tone: "gone" },
			{ where: "Other devices & members", what: "Members keep it", tone: "keep" },
		],
		confirmLabel: "Leave vault",
		destructive: true,
	}
}

export function deleteImpact(name: string, server: string, members: number): VaultImpact {
	return {
		title: `Delete ${name} from ${server}?`,
		description: "This removes it and its history for everyone. It can’t be undone.",
		cells: [
			{ where: "This Mac", what: "Nothing here", tone: "keep" },
			{ where: server, what: "Deleted", tone: "gone" },
			{
				where: "Other devices & members",
				what: members > 1 ? `${members} members lose it` : "Gone everywhere",
				tone: "gone",
			},
		],
		confirmLabel: "Delete for everyone",
		destructive: true,
		confirmName: name,
	}
}
