import { posix, win32 } from "node:path"

export type LinuxPackageManager = "system-package" | "snap" | "flatpak" | "tarball"

export type InstallType =
	| { kind: "dev" }
	| { kind: "mac-app"; bundlePath: string; inApplications: boolean }
	| { kind: "windows-nsis"; scope: "user" | "machine"; installDir: string }
	| { kind: "appimage"; appImagePath: string }
	| { kind: "linux-package"; manager: LinuxPackageManager }
	| { kind: "unknown"; platform: string }

export interface InstallEnvironment {
	platform: string
	isPackaged: boolean
	execPath: string
	env: Readonly<Record<string, string | undefined>>
	inApplicationsFolder: boolean
}

function isInside(parent: string, child: string): boolean {
	const relative = win32.relative(parent.toLowerCase(), child.toLowerCase())
	return relative !== "" && !relative.startsWith("..") && !win32.isAbsolute(relative)
}

function detectLinuxManager(environment: InstallEnvironment): LinuxPackageManager {
	if (environment.env.SNAP) return "snap"
	if (environment.env.FLATPAK_ID || environment.env.container === "flatpak") return "flatpak"
	if (environment.execPath.startsWith("/opt/") || environment.execPath.startsWith("/usr/")) {
		return "system-package"
	}
	return "tarball"
}

export function detectInstallType(environment: InstallEnvironment): InstallType {
	if (!environment.isPackaged) return { kind: "dev" }
	switch (environment.platform) {
		case "darwin":
			return {
				kind: "mac-app",
				bundlePath: posix.resolve(environment.execPath, "../../.."),
				inApplications: environment.inApplicationsFolder,
			}
		case "win32": {
			const installDir = win32.dirname(environment.execPath)
			const localAppData = environment.env.LOCALAPPDATA
			const scope = localAppData && isInside(localAppData, installDir) ? "user" : "machine"
			return { kind: "windows-nsis", scope, installDir }
		}
		case "linux": {
			const appImagePath = environment.env.APPIMAGE
			if (appImagePath && posix.isAbsolute(appImagePath)) return { kind: "appimage", appImagePath }
			return { kind: "linux-package", manager: detectLinuxManager(environment) }
		}
		default:
			return { kind: "unknown", platform: environment.platform }
	}
}

export function describeInstallType(installType: InstallType): string {
	switch (installType.kind) {
		case "windows-nsis":
			return `windows-nsis-${installType.scope}`
		case "linux-package":
			return `linux-${installType.manager}`
		case "unknown":
			return `unknown-${installType.platform}`
		default:
			return installType.kind
	}
}
