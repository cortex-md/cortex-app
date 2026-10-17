export interface MacInstallScriptOptions {
	pid: number
	currentAppPath: string
	newAppPath: string
	backupAppPath: string
	logPath: string
	executableName: string
	waitTimeoutSeconds?: number
	relaunchCommand?: string
}

export function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * Waits for the running app to exit, swaps the bundle through a sibling backup so every move is a
 * same-volume rename, and puts the previous bundle back if any step fails.
 */
export function buildMacInstallScript(options: MacInstallScriptOptions): string {
	const waitTicks = (options.waitTimeoutSeconds ?? 60) * 10
	const relaunch = options.relaunchCommand ?? "open"
	return `#!/bin/sh
set -u
PID=${options.pid}
CURRENT=${shellQuote(options.currentAppPath)}
NEW=${shellQuote(options.newAppPath)}
BACKUP=${shellQuote(options.backupAppPath)}
exec >>${shellQuote(options.logPath)} 2>&1
echo "[updates] $(date) waiting for $PID"
ticks=0
while kill -0 "$PID" 2>/dev/null; do
	ticks=$((ticks + 1))
	if [ "$ticks" -gt ${waitTicks} ]; then
		echo "[updates] app did not exit, update skipped"
		exit 1
	fi
	sleep 0.1
done
restore() {
	echo "[updates] $1, restoring the previous version"
	if [ -e "$BACKUP" ]; then
		rm -rf "$CURRENT"
		mv "$BACKUP" "$CURRENT"
	fi
	${relaunch} "$CURRENT"
	exit 1
}
rm -rf "$BACKUP"
mv "$CURRENT" "$BACKUP" || restore "backup failed"
mv "$NEW" "$CURRENT" || restore "replace failed"
xattr -dr com.apple.quarantine "$CURRENT" 2>/dev/null || true
[ -x "$CURRENT/Contents/MacOS/"${shellQuote(options.executableName)} ] || restore "new bundle is incomplete"
rm -rf "$BACKUP"
echo "[updates] installed, relaunching"
${relaunch} "$CURRENT"
`
}
