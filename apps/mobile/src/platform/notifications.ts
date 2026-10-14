import type {
	NativeNotificationAction,
	NativeNotificationPermissionState,
	NotificationActivation,
	NotificationPayload,
	Platform,
	ScheduledNotificationRequest,
} from "@cortex/platform"
import * as Notifications from "expo-notifications"
import { Linking } from "react-native"

const MAX_PENDING = 60
const SCOPE_KEY = "cortexScope"
const ID_KEY = "cortexId"
const PAYLOAD_KEY = "cortexPayload"

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldPlaySound: true,
		shouldSetBadge: false,
		shouldShowBanner: true,
		shouldShowList: true,
	}),
})

function toPermission(status: Notifications.PermissionStatus): NativeNotificationPermissionState {
	if (status === Notifications.PermissionStatus.GRANTED) return "granted"
	if (status === Notifications.PermissionStatus.DENIED) return "denied"
	return "prompt"
}

function identifier(scope: string, id: string): string {
	return `${scope}::${id}`
}

const registeredCategories = new Map<string, Promise<void>>()

function categoryFor(actions: NativeNotificationAction[] | undefined): Promise<string | undefined> {
	if (!actions || actions.length === 0) return Promise.resolve(undefined)
	const categoryId = `cortex-${actions.map((action) => action.id).join("-")}`
	let registration = registeredCategories.get(categoryId)
	if (!registration) {
		registration = Notifications.setNotificationCategoryAsync(
			categoryId,
			actions.map((action) => ({
				identifier: action.id,
				buttonTitle: action.label,
				options: { opensAppToForeground: true },
			})),
		).then(() => undefined)
		registeredCategories.set(categoryId, registration)
	}
	return registration.then(() => categoryId)
}

function signature(request: ScheduledNotificationRequest): string {
	return JSON.stringify([
		request.fireAt,
		request.title,
		request.body ?? "",
		request.payload ?? null,
	])
}

async function scheduleOne(scope: string, request: ScheduledNotificationRequest): Promise<void> {
	await Notifications.scheduleNotificationAsync({
		identifier: identifier(scope, request.id),
		content: {
			title: request.title,
			body: request.body,
			sound: request.silent ? false : "default",
			categoryIdentifier: await categoryFor(request.actions),
			data: {
				[SCOPE_KEY]: scope,
				[ID_KEY]: request.id,
				[PAYLOAD_KEY]: request.payload ?? null,
				signature: signature(request),
			},
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: new Date(request.fireAt),
		},
	})
}

async function schedule(scope: string, requests: ScheduledNotificationRequest[]): Promise<void> {
	const now = Date.now()
	const wanted = requests
		.filter((request) => request.fireAt > now)
		.sort((left, right) => left.fireAt - right.fireAt)
		.slice(0, MAX_PENDING)
	const wantedById = new Map(wanted.map((request) => [identifier(scope, request.id), request]))
	const existing = await Notifications.getAllScheduledNotificationsAsync()
	const kept = new Set<string>()
	for (const pending of existing) {
		const data = pending.content.data as Record<string, unknown> | undefined
		if (data?.[SCOPE_KEY] !== scope) continue
		const request = wantedById.get(pending.identifier)
		if (request && data.signature === signature(request)) {
			kept.add(pending.identifier)
			continue
		}
		await Notifications.cancelScheduledNotificationAsync(pending.identifier)
	}
	for (const [id, request] of wantedById) {
		if (!kept.has(id)) await scheduleOne(scope, request)
	}
}

function toActivation(response: Notifications.NotificationResponse): NotificationActivation | null {
	const data = response.notification.request.content.data as Record<string, unknown> | undefined
	const scope = data?.[SCOPE_KEY]
	const id = data?.[ID_KEY]
	if (typeof scope !== "string" || typeof id !== "string") return null
	const actionId =
		response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
			? null
			: response.actionIdentifier
	return {
		scope,
		notificationId: id,
		actionId,
		payload: (data?.[PAYLOAD_KEY] as NotificationPayload | null) ?? undefined,
		reply: response.userText,
	}
}

export const notificationsApi = {
	getCapabilities: () => ({
		actions: true,
		icons: false,
		schedule: true,
		sounds: true,
		supported: true,
	}),
	getPermission: async () => toPermission((await Notifications.getPermissionsAsync()).status),
	requestPermission: async () =>
		toPermission((await Notifications.requestPermissionsAsync()).status),
	send: async (notification) => {
		const permission = await Notifications.getPermissionsAsync()
		if (permission.status !== Notifications.PermissionStatus.GRANTED) {
			return { delivered: false, reason: "permission-denied" }
		}
		try {
			await Notifications.scheduleNotificationAsync({
				identifier: notification.id,
				content: {
					title: notification.title,
					body: notification.body,
					sound: notification.silent ? false : "default",
					data: notification.metadata ?? {},
				},
				trigger: null,
			})
			return { delivered: true }
		} catch {
			return { delivered: false, reason: "failed" }
		}
	},
	schedule,
	onActivation: (listener) => {
		let lastHandled: string | null = null
		const handle = (response: Notifications.NotificationResponse | null) => {
			if (!response) return
			const key = `${response.notification.request.identifier}:${response.actionIdentifier}`
			if (key === lastHandled) return
			lastHandled = key
			const activation = toActivation(response)
			if (activation) listener(activation)
		}
		void Notifications.getLastNotificationResponseAsync().then(handle)
		const subscription = Notifications.addNotificationResponseReceivedListener(handle)
		return () => subscription.remove()
	},
	openSystemSettings: () => Linking.openSettings(),
} satisfies Platform["notifications"]
