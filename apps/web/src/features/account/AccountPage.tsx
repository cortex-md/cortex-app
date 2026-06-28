import { Alert, AlertDescription, AlertTitle } from "@cortex/ui/alert"
import { Badge } from "@cortex/ui/badge"
import { Button } from "@cortex/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cortex/ui/card"
import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	Clock3,
	CreditCard,
	Database,
	HardDrive,
	Laptop,
	Loader2,
	LogOut,
	RefreshCw,
	ShieldCheck,
	Smartphone,
	UserRound,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
	type AccountDeviceSummary,
	type AccountOverviewResult,
	type AccountVaultRole,
	type AccountVaultSummary,
	getAccountOverview,
	type SubscriptionStatus,
} from "../../server/account"
import { logout } from "../../server/auth"
import { ThemeToggle } from "../site/ThemeToggle"

type ReadyAccountOverview = Extract<AccountOverviewResult, { authenticated: true }>

type AccountState =
	| { state: "loading" }
	| { state: "redirecting"; redirectTo: string }
	| { state: "ready"; overview: ReadyAccountOverview }
	| { state: "error"; message: string }

type AccountOverviewLoader = () => Promise<AccountOverviewResult>
type LogoutAction = (options: { data: { allDevices?: boolean } }) => Promise<{ ok: true }>

interface AccountPageProps {
	getOverview?: AccountOverviewLoader
	initialOverview?: ReadyAccountOverview
	logoutAction?: LogoutAction
	redirectTo?: (url: string) => void
}

let sharedOverviewPromise: Promise<AccountOverviewResult> | null = null

function defaultRedirectTo(url: string) {
	window.location.assign(url)
}

function defaultGetOverview() {
	if (!sharedOverviewPromise) {
		sharedOverviewPromise = getAccountOverview().finally(() => {
			sharedOverviewPromise = null
		})
	}

	return sharedOverviewPromise
}

function defaultLogoutAction(options: { data: { allDevices?: boolean } }) {
	return logout(options)
}

function formatDate(value: string | null, fallback = "Not available") {
	if (!value) return fallback

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return fallback

	return new Intl.DateTimeFormat("en", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(date)
}

function formatDateTime(value: string | null, fallback = "Not seen yet") {
	if (!value) return fallback

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return fallback

	return new Intl.DateTimeFormat("en", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date)
}

function formatBillingCycle(value: string | null) {
	if (!value) return "Not available"
	return value
		.toLowerCase()
		.split(/[_\s-]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")
}

function getPlanStatusLabel(subscription: SubscriptionStatus) {
	return subscription.entitled ? "Active" : "Inactive"
}

function getPlanStatusClass(status: "Active" | "Inactive" | "Unavailable") {
	if (status === "Active") return "bg-accent-sage-subtle text-accent-sage-text"
	if (status === "Unavailable") return "bg-accent-amber-subtle text-accent-amber-text"
	return "bg-bg-tertiary text-text-secondary"
}

function getRoleLabel(role: AccountVaultRole) {
	switch (role) {
		case "owner":
			return "Owner"
		case "admin":
			return "Admin"
		case "editor":
			return "Editor"
		case "viewer":
			return "Viewer"
		default:
			return "Viewer"
	}
}

function getDeviceTypeLabel(type: string) {
	const normalizedType = type.toLowerCase()
	if (normalizedType === "desktop") return "Desktop"
	if (normalizedType === "mobile") return "Mobile"
	if (normalizedType === "web") return "Web"
	return type === "unknown" ? "Device" : type
}

function getDeviceIcon(type: string) {
	const normalizedType = type.toLowerCase()
	if (normalizedType === "mobile") return Smartphone
	if (normalizedType === "web") return Laptop
	return HardDrive
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`
}

function AccountHeader({
	isLoggingOut,
	onLogout,
}: {
	isLoggingOut: boolean
	onLogout: () => void
}) {
	return (
		<header className="fixed inset-x-0 top-3 z-50 px-3 max-sm:top-2">
			<div className="mx-auto flex h-14 w-[min(960px,calc(100%_-_24px))] items-center justify-between rounded-xl px-3 backdrop-blur-xl [background:var(--site-header-glass)] [box-shadow:var(--site-header-shadow)] max-sm:h-[52px] max-sm:w-full">
				<a
					className="inline-flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 py-1 text-[16px] font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
					href="/"
					aria-label="Cortex home"
				>
					<img className="block rounded-lg" src="/icon-192.png" width={30} height={30} alt="" />
					<span>Cortex</span>
				</a>
				<div className="flex items-center gap-1.5">
					<ThemeToggle />
					<Button
						className="min-h-10 tracking-normal active:scale-[0.96]"
						variant="ghost"
						type="button"
						onClick={onLogout}
						disabled={isLoggingOut}
					>
						{isLoggingOut ? (
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<LogOut className="size-4" aria-hidden="true" />
						)}
						Log out
					</Button>
				</div>
			</div>
		</header>
	)
}

function LoadingAccount() {
	return (
		<div className="grid gap-4">
			<div className="h-36 animate-pulse rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]" />
			<div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
				<div className="h-64 animate-pulse rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]" />
				<div className="h-64 animate-pulse rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]" />
			</div>
		</div>
	)
}

function DataRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-1 rounded-lg bg-bg-secondary px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border-subtle)]">
			<span className="text-[12px] leading-4 text-text-muted">{label}</span>
			<span className="text-[13px] leading-5 font-medium text-text-primary">{value}</span>
		</div>
	)
}

function SummaryTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-lg bg-bg-secondary px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border-subtle)]">
			<p className="m-0 text-[12px] leading-4 text-text-muted">{label}</p>
			<p className="mt-1 truncate text-[13px] leading-5 font-semibold text-text-primary">{value}</p>
		</div>
	)
}

function UnavailableState({ message }: { message: string }) {
	return (
		<div className="rounded-lg bg-bg-secondary px-3 py-3 text-[13px] leading-5 text-text-secondary shadow-[inset_0_0_0_1px_var(--border-subtle)]">
			<Badge className="mb-2 bg-accent-amber-subtle text-accent-amber-text">Unavailable</Badge>
			<p className="m-0">{message}</p>
		</div>
	)
}

function PlanCard({ subscription }: { subscription: ReadyAccountOverview["subscription"] }) {
	if (!subscription.available) {
		return (
			<Card className="rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]">
				<CardHeader>
					<div className="flex items-start justify-between gap-4">
						<div>
							<CardTitle className="flex items-center gap-2 text-[18px] leading-6">
								<CreditCard className="size-4 text-text-muted" aria-hidden="true" />
								Plan
							</CardTitle>
							<CardDescription className="mt-1">
								Hosted Sync status for this Cortex account.
							</CardDescription>
						</div>
						<Badge className={getPlanStatusClass("Unavailable")}>Unavailable</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<UnavailableState message={subscription.message} />
				</CardContent>
			</Card>
		)
	}

	const status = subscription.status
	const statusLabel = getPlanStatusLabel(status)

	return (
		<Card className="rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]">
			<CardHeader>
				<div className="flex items-start justify-between gap-4 max-sm:grid">
					<div>
						<CardTitle className="flex items-center gap-2 text-[18px] leading-6">
							<CreditCard className="size-4 text-text-muted" aria-hidden="true" />
							Plan
						</CardTitle>
						<CardDescription className="mt-1">
							Hosted Cortex Sync is optional. Self-hosting remains available.
						</CardDescription>
					</div>
					<Badge className={getPlanStatusClass(statusLabel)}>{statusLabel}</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
					<DataRow label="Hosted Sync" value={status.entitled ? "Included" : "Optional"} />
					<DataRow label="Billing cycle" value={formatBillingCycle(status.billingCycle)} />
					<DataRow label="Current period ends" value={formatDate(status.currentPeriodEnd)} />
					<DataRow
						label="Access through"
						value={formatDate(status.entitlementExpiresAt ?? status.currentPeriodEnd)}
					/>
				</div>

				{status.entitled ? (
					<div className="mt-5 flex items-center gap-2 rounded-lg bg-accent-sage-subtle px-3 py-2.5 text-[13px] leading-5 text-accent-sage-text">
						<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
						<span>Hosted Sync is available for this account.</span>
					</div>
				) : (
					<div className="mt-5 flex flex-wrap items-center gap-3">
						<Button className="min-h-10 active:scale-[0.96]" asChild>
							<a href="/billing">
								Upgrade hosted Sync
								<ArrowRight className="size-4" aria-hidden="true" />
							</a>
						</Button>
						<p className="m-0 text-[12px] leading-5 text-text-muted">
							Local Markdown vaults and self-hosted Sync do not require this plan.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function DeviceItem({ device }: { device: AccountDeviceSummary }) {
	const DeviceIcon = getDeviceIcon(device.type)

	return (
		<li className="grid gap-2 border-border-subtle border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-bg-secondary text-text-muted shadow-[inset_0_0_0_1px_var(--border-subtle)]">
						<DeviceIcon className="size-4" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<p className="m-0 truncate text-[14px] leading-5 font-semibold text-text-primary">
							{device.name}
						</p>
						<p className="mt-1 text-[12px] leading-5 text-text-muted">
							{getDeviceTypeLabel(device.type)} · Last seen {formatDateTime(device.lastSeenAt)}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 flex-wrap justify-end gap-1.5">
					{device.isCurrent ? (
						<Badge className="bg-accent-sky-subtle text-accent-sky-text">This device</Badge>
					) : null}
					{device.isRevoked ? (
						<Badge className="bg-accent-coral-subtle text-accent-coral-text">Revoked</Badge>
					) : null}
				</div>
			</div>
			<p className="m-0 pl-11 text-[12px] leading-5 text-text-muted">
				Added {formatDate(device.createdAt, "Not available")}
			</p>
		</li>
	)
}

function DevicesCard({ devices }: { devices: ReadyAccountOverview["devices"] }) {
	const count = devices.available ? devices.devices.length : null

	return (
		<Card className="rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]">
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="flex items-center gap-2 text-[18px] leading-6">
							<Laptop className="size-4 text-text-muted" aria-hidden="true" />
							Devices
						</CardTitle>
						<CardDescription className="mt-1">
							Signed-in devices known to Cortex Sync.
						</CardDescription>
					</div>
					<Badge className="bg-bg-tertiary text-text-secondary">
						{count === null ? "Unavailable" : formatCount(count, "device")}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{devices.available ? (
					devices.devices.length > 0 ? (
						<ul className="m-0 grid list-none p-0">
							{devices.devices.map((device) => (
								<DeviceItem
									device={device}
									key={`${device.name}-${device.type}-${device.createdAt ?? device.lastSeenAt ?? "unknown"}`}
								/>
							))}
						</ul>
					) : (
						<p className="m-0 rounded-lg bg-bg-secondary px-3 py-3 text-[13px] leading-5 text-text-secondary shadow-[inset_0_0_0_1px_var(--border-subtle)]">
							No devices to show yet.
						</p>
					)
				) : (
					<UnavailableState message={devices.message} />
				)}
			</CardContent>
		</Card>
	)
}

function VaultItem({ vault }: { vault: AccountVaultSummary }) {
	return (
		<li className="grid gap-2 border-border-subtle border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="m-0 truncate text-[14px] leading-5 font-semibold text-text-primary">
						{vault.name}
					</p>
					{vault.description ? (
						<p className="mt-1 text-[12px] leading-5 text-text-muted">{vault.description}</p>
					) : null}
				</div>
				<Badge className="shrink-0 bg-bg-tertiary text-text-secondary">
					{getRoleLabel(vault.role)}
				</Badge>
			</div>
			<p className="m-0 text-[12px] leading-5 text-text-muted">
				{vault.memberCount === null
					? "Members unavailable"
					: formatCount(vault.memberCount, "member")}{" "}
				· Updated {formatDate(vault.updatedAt)}
			</p>
		</li>
	)
}

function VaultsCard({ vaults }: { vaults: ReadyAccountOverview["vaults"] }) {
	const count = vaults.available ? vaults.vaults.length : null

	return (
		<Card className="rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]">
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="flex items-center gap-2 text-[18px] leading-6">
							<Database className="size-4 text-text-muted" aria-hidden="true" />
							Vaults
						</CardTitle>
						<CardDescription className="mt-1">
							Shared Markdown workspaces connected to this account.
						</CardDescription>
					</div>
					<Badge className="bg-bg-tertiary text-text-secondary">
						{count === null ? "Unavailable" : formatCount(count, "vault")}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{vaults.available ? (
					vaults.vaults.length > 0 ? (
						<ul className="m-0 grid list-none p-0">
							{vaults.vaults.map((vault) => (
								<VaultItem
									vault={vault}
									key={`${vault.name}-${vault.role}-${vault.updatedAt ?? vault.memberCount ?? "unknown"}`}
								/>
							))}
						</ul>
					) : (
						<p className="m-0 rounded-lg bg-bg-secondary px-3 py-3 text-[13px] leading-5 text-text-secondary shadow-[inset_0_0_0_1px_var(--border-subtle)]">
							Vaults created or joined from Cortex will appear here.
						</p>
					)
				) : (
					<UnavailableState message={vaults.message} />
				)}
			</CardContent>
		</Card>
	)
}

function AccountCard({ email }: { email: string }) {
	return (
		<Card className="rounded-xl bg-bg-elevated shadow-[0_0_0_1px_var(--border-subtle)]">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-[18px] leading-6">
					<UserRound className="size-4 text-text-muted" aria-hidden="true" />
					Account
				</CardTitle>
				<CardDescription className="mt-1">
					Your browser session is remembered securely after sign in.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3">
					<DataRow label="Email" value={email} />
					<div className="flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2.5 text-[13px] leading-5 text-text-secondary shadow-[inset_0_0_0_1px_var(--border-subtle)]">
						<ShieldCheck className="size-4 shrink-0 text-accent-sage-text" aria-hidden="true" />
						<span>Account access is stored in a secure browser session.</span>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function AccountDashboard({ overview }: { overview: ReadyAccountOverview }) {
	const planStatus =
		overview.subscription.available && overview.subscription.status.entitled
			? "Active"
			: "Signed in"
	const deviceSummary = overview.devices.available
		? formatCount(overview.devices.devices.length, "device")
		: "Unavailable"
	const vaultSummary = overview.vaults.available
		? formatCount(overview.vaults.vaults.length, "vault")
		: "Unavailable"

	return (
		<div className="grid gap-4">
			<section className="rounded-xl bg-bg-elevated p-5 shadow-[0_0_0_1px_var(--border-subtle)]">
				<div className="flex items-start justify-between gap-5 max-md:grid">
					<div className="min-w-0">
						<p className="m-0 text-[13px] leading-5 text-text-muted">Signed in as</p>
						<h2 className="mt-1 mb-0 truncate text-[22px] leading-7 font-semibold text-text-primary">
							{overview.session.email}
						</h2>
					</div>
					<Badge className="bg-accent-sage-subtle text-accent-sage-text">{planStatus}</Badge>
				</div>
				<div className="mt-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
					<SummaryTile label="Account" value="Secure browser session" />
					<SummaryTile label="Vaults" value={vaultSummary} />
					<SummaryTile label="Devices" value={deviceSummary} />
				</div>
			</section>

			<div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)] gap-4 max-lg:grid-cols-1">
				<div className="grid gap-4">
					<PlanCard subscription={overview.subscription} />
					<VaultsCard vaults={overview.vaults} />
				</div>
				<div className="grid content-start gap-4">
					<DevicesCard devices={overview.devices} />
					<AccountCard email={overview.session.email} />
				</div>
			</div>
		</div>
	)
}

export function AccountPage({
	getOverview = defaultGetOverview,
	initialOverview,
	logoutAction = defaultLogoutAction,
	redirectTo = defaultRedirectTo,
}: AccountPageProps) {
	const [state, setState] = useState<AccountState>(() =>
		initialOverview ? { state: "ready", overview: initialOverview } : { state: "loading" },
	)
	const [isLoggingOut, setIsLoggingOut] = useState(false)
	const isLoadingRef = useRef(false)
	const isLoggingOutRef = useRef(false)

	const loadOverview = useCallback(async () => {
		if (isLoadingRef.current) return
		isLoadingRef.current = true
		setState({ state: "loading" })

		try {
			const overview = await getOverview()

			if (!overview.authenticated) {
				setState({ state: "redirecting", redirectTo: overview.redirectTo })
				redirectTo(overview.redirectTo)
				return
			}

			setState({ state: "ready", overview })
		} catch {
			setState({
				state: "error",
				message: "Cortex could not load your account. Try again in a moment.",
			})
		} finally {
			isLoadingRef.current = false
		}
	}, [getOverview, redirectTo])

	useEffect(() => {
		if (initialOverview) {
			setState({ state: "ready", overview: initialOverview })
			return
		}

		void loadOverview()
	}, [initialOverview, loadOverview])

	const handleLogout = useCallback(() => {
		if (isLoggingOutRef.current) return
		isLoggingOutRef.current = true
		setIsLoggingOut(true)

		void logoutAction({ data: {} })
			.catch(() => ({ ok: true as const }))
			.then(() => {
				redirectTo("/login?redirect=/account")
			})
	}, [logoutAction, redirectTo])

	const readyOverview = state.state === "ready" ? state.overview : null

	return (
		<div className="min-h-screen bg-background text-foreground">
			<AccountHeader isLoggingOut={isLoggingOut} onLogout={handleLogout} />
			<main
				className="mx-auto min-h-screen w-[min(1080px,calc(100%_-_48px))] pt-32 pb-20 max-md:w-[min(760px,calc(100%_-_36px))] max-sm:w-[min(100%_-_28px,520px)]"
				id="main-content"
				tabIndex={-1}
			>
				<div className="mb-8 flex items-end justify-between gap-5 max-md:grid">
					<div>
						<p className="m-0 text-[14px] leading-6 font-medium text-text-muted">Cortex account</p>
						<h1 className="mt-2 mb-0 text-[34px] leading-[1.08] font-semibold text-text-primary">
							Account
						</h1>
						<p className="mt-3 mb-0 max-w-[620px] text-[15px] leading-6 text-text-secondary">
							A compact view of your hosted plan, synced vaults, devices, and account session.
						</p>
					</div>
					<Button className="min-h-10 active:scale-[0.96]" variant="outline" asChild>
						<a href="/#pricing">View pricing</a>
					</Button>
				</div>

				{state.state === "loading" ? <LoadingAccount /> : null}

				{state.state === "redirecting" ? (
					<div className="grid justify-items-center rounded-xl bg-bg-elevated p-8 text-center shadow-[0_0_0_1px_var(--border-subtle)]">
						<Clock3 className="size-5 text-text-muted" aria-hidden="true" />
						<h2 className="mt-4 mb-0 text-[20px] leading-7 font-semibold">Taking you to sign in</h2>
						<p className="mt-2 text-[14px] leading-6 text-text-secondary">
							Sign in to view your account.
						</p>
					</div>
				) : null}

				{state.state === "error" ? (
					<div className="grid max-w-[520px] gap-4">
						<Alert variant="destructive" role="alert">
							<AlertCircle className="size-4" aria-hidden="true" />
							<AlertTitle>Account unavailable</AlertTitle>
							<AlertDescription>{state.message}</AlertDescription>
						</Alert>
						<Button
							className="w-fit min-h-10 active:scale-[0.96]"
							type="button"
							onClick={loadOverview}
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							Try again
						</Button>
					</div>
				) : null}

				{readyOverview ? <AccountDashboard overview={readyOverview} /> : null}
			</main>
		</div>
	)
}
