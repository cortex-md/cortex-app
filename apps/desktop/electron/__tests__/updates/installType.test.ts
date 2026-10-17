import { describe, expect, it } from "vitest"
import { detectInstallType, type InstallEnvironment } from "../../updates/installType"

function environment(overrides: Partial<InstallEnvironment>): InstallEnvironment {
	return {
		platform: "darwin",
		isPackaged: true,
		execPath: "/Applications/Cortex.app/Contents/MacOS/Cortex",
		env: {},
		inApplicationsFolder: true,
		...overrides,
	}
}

describe("install type detection", () => {
	it("treats unpackaged builds as development", () => {
		expect(detectInstallType(environment({ isPackaged: false }))).toEqual({ kind: "dev" })
	})

	it("resolves the macOS bundle from the executable", () => {
		expect(detectInstallType(environment({}))).toEqual({
			kind: "mac-app",
			bundlePath: "/Applications/Cortex.app",
			inApplications: true,
		})
		expect(
			detectInstallType(
				environment({
					execPath: "/Users/me/Downloads/Cortex.app/Contents/MacOS/Cortex",
					inApplicationsFolder: false,
				}),
			),
		).toMatchObject({ kind: "mac-app", inApplications: false })
	})

	it("tells per-user and per-machine Windows installs apart", () => {
		const env = { LOCALAPPDATA: "C:\\Users\\Ana Maria\\AppData\\Local" }
		expect(
			detectInstallType(
				environment({
					platform: "win32",
					env,
					execPath: "C:\\Users\\Ana Maria\\AppData\\Local\\Programs\\cortex\\Cortex.exe",
				}),
			),
		).toEqual({
			kind: "windows-nsis",
			scope: "user",
			installDir: "C:\\Users\\Ana Maria\\AppData\\Local\\Programs\\cortex",
		})
		expect(
			detectInstallType(
				environment({
					platform: "win32",
					env,
					execPath: "C:\\Program Files\\Cortex\\Cortex.exe",
				}),
			),
		).toMatchObject({ kind: "windows-nsis", scope: "machine" })
		expect(
			detectInstallType(
				environment({
					platform: "win32",
					env: { LOCALAPPDATA: "c:\\users\\ana maria\\appdata\\local" },
					execPath: "C:\\Users\\Ana Maria\\AppData\\Local\\Programs\\cortex\\Cortex.exe",
				}),
			),
		).toMatchObject({ scope: "user" })
	})

	it("detects AppImage and package-manager installs on Linux", () => {
		const linux = { platform: "linux", execPath: "/tmp/.mount_Cortex/cortex" }
		expect(
			detectInstallType(
				environment({ ...linux, env: { APPIMAGE: "/home/me/Apps/Cortex.AppImage" } }),
			),
		).toEqual({ kind: "appimage", appImagePath: "/home/me/Apps/Cortex.AppImage" })
		expect(
			detectInstallType(environment({ ...linux, env: { APPIMAGE: "relative.AppImage" } })),
		).toMatchObject({
			kind: "linux-package",
		})
		expect(
			detectInstallType(environment({ platform: "linux", execPath: "/opt/Cortex/cortex" })),
		).toEqual({
			kind: "linux-package",
			manager: "system-package",
		})
		expect(
			detectInstallType(environment({ platform: "linux", env: { SNAP: "/snap/cortex/1" } })),
		).toEqual({
			kind: "linux-package",
			manager: "snap",
		})
		expect(
			detectInstallType(
				environment({ platform: "linux", env: { FLATPAK_ID: "app.cortex.desktop" } }),
			),
		).toEqual({ kind: "linux-package", manager: "flatpak" })
		expect(
			detectInstallType(environment({ platform: "linux", execPath: "/home/me/cortex/cortex" })),
		).toEqual({ kind: "linux-package", manager: "tarball" })
	})
})
