import { join } from "node:path"
import { configureSyncRuntime } from "@cortex/sync-engine"
import { app } from "electron"
import { registerIpcHandlers } from "./ipc/register"
import { forgetMenuState, setupApplicationMenu, syncApplicationMenu } from "./menu"
import { nodeSyncRuntime } from "./platform/nodeSyncRuntime"
import { applyDevelopmentProfile } from "./profile"
import {
	appUrl,
	registerAppProtocol,
	registerCortexFileProtocol,
	registerPrivilegedSchemes,
} from "./protocols"
import { setTrustedRendererUrl } from "./security"
import { addRegistryChangedListener } from "./services/registry"
import { startReminderScheduler } from "./services/reminderScheduler"
import { disposeSyncSession, stopSyncWorkers } from "./services/syncBridge"
import {
	configureWindows,
	emitToTargetWindow,
	focusMainWindow,
	onMainWindowClosed,
	onWindowsChanged,
	openNewWindow,
	openStartupWindow,
	openVaultWindow,
} from "./windows"

configureSyncRuntime(nodeSyncRuntime)

process.on("unhandledRejection", (reason) => {
	console.error("[main] unhandled rejection:", reason)
})

const profile = applyDevelopmentProfile()
registerPrivilegedSchemes()

const OPEN_VAULT_ARG = "--open-vault="
const NEW_WINDOW_ARG = "--new-window"

function preloadPath(): string {
	return join(__dirname, "../preload/index.cjs")
}

const rendererRoot = join(__dirname, "../renderer")
const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? appUrl("index.html")

interface LaunchRequest {
	vaultPath: string | null
	newWindow: boolean
	deepLinks: string[]
}

function parseLaunchArgs(argv: readonly string[]): LaunchRequest {
	const vaultArg = argv.find((arg) => arg.startsWith(OPEN_VAULT_ARG))
	return {
		vaultPath: vaultArg ? vaultArg.slice(OPEN_VAULT_ARG.length).replace(/^"|"$/g, "") : null,
		newWindow: argv.includes(NEW_WINDOW_ARG),
		deepLinks: argv.filter((arg) => arg.startsWith("cortex://")),
	}
}

function handleLaunch(request: LaunchRequest, isFirstLaunch: boolean): void {
	if (request.vaultPath) openVaultWindow(request.vaultPath)
	else if (request.newWindow) openNewWindow()
	else if (isFirstLaunch) openStartupWindow()
	else focusMainWindow()
	if (request.deepLinks.length > 0) emitToTargetWindow("deep-link-open", request.deepLinks)
}

const pendingOpenUrls: string[] = []

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
	app.quit()
} else {
	app.on("second-instance", (_event, argv) => {
		handleLaunch(parseLaunchArgs(argv), false)
	})

	app.whenReady().then(() => {
		setTrustedRendererUrl(rendererUrl)
		registerAppProtocol(rendererRoot)
		registerCortexFileProtocol()
		registerIpcHandlers()
		configureWindows(rendererUrl, preloadPath())
		addRegistryChangedListener(setupApplicationMenu)
		onWindowsChanged((reason) => {
			if (reason === "focus") syncApplicationMenu()
			else setupApplicationMenu()
		})
		onMainWindowClosed(disposeSyncSession)
		onMainWindowClosed(forgetMenuState)
		setupApplicationMenu()
		startReminderScheduler().catch((error) =>
			console.warn("[reminders] failed to start scheduler:", error),
		)
		const launch = parseLaunchArgs(process.argv)
		handleLaunch(
			{ ...launch, deepLinks: [...launch.deepLinks, ...pendingOpenUrls.splice(0)] },
			true,
		)

		app.on("activate", focusMainWindow)
	})

	app.on("open-url", (event, url) => {
		event.preventDefault()
		if (app.isReady()) emitToTargetWindow("deep-link-open", [url])
		else pendingOpenUrls.push(url)
	})

	if (profile) {
		console.info(`[profile] running isolated profile "${profile}" at ${app.getPath("userData")}`)
	} else if (process.defaultApp) {
		if (process.argv.length >= 2) {
			app.setAsDefaultProtocolClient("cortex", process.execPath, [join(process.argv[1]!)])
		}
	} else {
		app.setAsDefaultProtocolClient("cortex")
	}

	app.on("before-quit", stopSyncWorkers)

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit()
		}
	})
}
