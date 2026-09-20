import { app, BrowserWindow } from "electron"
import { join } from "node:path"
import { emitToRenderer } from "./events"
import { registerIpcHandlers } from "./ipc/register"
import { refreshMenuRecents, setupApplicationMenu } from "./menu"
import { registerCortexFileProtocol, registerPrivilegedSchemes } from "./protocols"
import { setRegistryChangedListener } from "./services/registry"
import { createMainWindow, focusMainWindow } from "./window"

registerPrivilegedSchemes()

const isDev = !app.isPackaged
const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL || "http://localhost:1420"

function preloadPath(): string {
	return join(__dirname, "../preload/index.js")
}

function createWindow(): BrowserWindow {
	const loadUrl = isDev
		? RENDERER_DEV_URL
		: `file://${join(__dirname, "../renderer/index.html")}`
	return createMainWindow(loadUrl, preloadPath())
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
	app.quit()
} else {
	app.on("second-instance", (_event, argv) => {
		focusMainWindow()
		const deepLinks = argv.filter((arg) => arg.startsWith("cortex://"))
		if (deepLinks.length > 0) {
			emitToRenderer("deep-link-open", deepLinks)
		}
	})

	app.whenReady().then(() => {
		registerCortexFileProtocol()
		registerIpcHandlers()
		setRegistryChangedListener(() => refreshMenuRecents())
		setupApplicationMenu()
		createWindow()

		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				createWindow()
			} else {
				focusMainWindow()
			}
		})
	})

	app.on("open-url", (event, url) => {
		event.preventDefault()
		emitToRenderer("deep-link-open", [url])
	})

	if (process.defaultApp) {
		if (process.argv.length >= 2) {
			app.setAsDefaultProtocolClient("cortex", process.execPath, [join(process.argv[1]!)])
		}
	} else {
		app.setAsDefaultProtocolClient("cortex")
	}

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit()
		}
	})
}
