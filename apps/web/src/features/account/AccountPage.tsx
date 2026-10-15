import { Alert, AlertDescription } from "@cortex/ui/alert"
import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { Skeleton } from "@cortex/ui/skeleton"
import { Toaster, toast } from "@cortex/ui/sonner"
import { Spinner } from "@cortex/ui/spinner"
import { StatusBadge, type StatusBadgeColor } from "@cortex/ui/status-badge"
import { ArrowRight, Globe, Laptop, LogOut, RefreshCw, Smartphone, Vault } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import {
	accountCopy,
	deviceTypeLabels,
	type PlanTone,
	planCopy,
	vaultRoleLabels,
} from "../../content/account"
import { trackEvent } from "../../lib/analytics"
import {
	type AccountDeviceSummary,
	type AccountOverviewResult,
	type AccountVaultSummary,
	getAccountOverview,
	type RevokeAccountDeviceResult,
	revokeAccountDevice,
} from "../../server/account"
import { logout } from "../../server/auth"
import {
	formatDate,
	formatRelative,
	formatRelativeDay,
	getDeviceKind,
	getPlanLine,
	isActiveNow,
	resolvePlanState,
} from "./accountFormat"

type ReadyAccountOverview = Extract<AccountOverviewResult, { authenticated: true }>

type AccountState =
	| { state: "loading" }
	| { state: "redirecting"; redirectTo: string }
	| { state: "ready"; overview: ReadyAccountOverview }
	| { state: "error"; message: string }

type AccountOverviewLoader = () => Promise<AccountOverviewResult>
type LogoutAction = (options: { data: { allDevices?: boolean } }) => Promise<{ ok: true }>
type RevokeAction = (options: { data: { deviceId: string } }) => Promise<RevokeAccountDeviceResult>

interface AccountPageProps {
	getOverview?: AccountOverviewLoader
	initialOverview?: ReadyAccountOverview
	logoutAction?: LogoutAction
	revokeAction?: RevokeAction
	redirectTo?: (url: string) => void
}

const smallButton = "h-[34px] px-3.5 text-[14px] max-sm:h-10"
const listClass = "m-0 grid list-none overflow-hidden rounded-[18px] bg-bg-elevated p-0 shadow-ring"
const rowClass =
	"flex min-h-[68px] flex-wrap items-center gap-3.5 border-sep border-t px-4 py-3 first:border-t-0 max-sm:gap-3 max-sm:px-3.5"

const toneColors: Record<PlanTone, StatusBadgeColor> = {
	ok: "green",
	warn: "amber",
	info: "pink",
	muted: "gray",
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

function defaultRevokeAction(options: { data: { deviceId: string } }) {
	return revokeAccountDevice(options)
}

function getInitial(email: string) {
	return email.trim().charAt(0).toUpperCase() || "C"
}

function sortDevices(devices: AccountDeviceSummary[]) {
	return [...devices].sort((a, b) => Number(a.isRevoked) - Number(b.isRevoked))
}

function getDeviceMeta(device: AccountDeviceSummary) {
	const kind = getDeviceKind(device.type)
	const seen = device.isRevoked
		? accountCopy.signedOut
		: isActiveNow(device.lastSeenAt) || device.isCurrent
			? accountCopy.activeNow
			: formatRelative(device.lastSeenAt)
				? `${accountCopy.lastSeen} ${formatRelative(device.lastSeenAt)}`
				: null
	const added = formatDate(device.createdAt)
	return [deviceTypeLabels[kind], seen, added ? `${accountCopy.added} ${added}` : null]
		.filter(Boolean)
		.join(" · ")
}

function getVaultMeta(vault: AccountVaultSummary) {
	const members =
		vault.memberCount === null
			? null
			: `${vault.memberCount} ${vault.memberCount === 1 ? accountCopy.member : accountCopy.members}`
	const updated = formatRelativeDay(vault.updatedAt)
	return [vault.description, members, updated ? `${accountCopy.updated} ${updated}` : null]
		.filter(Boolean)
		.join(" · ")
}

function SectionHeading({ id, title, count }: { id: string; title: string; count?: string }) {
	return (
		<div className="mb-3.5 flex items-baseline gap-2.5">
			<h2 id={id} className="m-0 text-[20px] leading-[1.25] font-semibold tracking-[-0.015em]">
				{title}
			</h2>
			{count ? (
				<span className="text-[14px] leading-none font-medium text-text-muted">{count}</span>
			) : null}
		</div>
	)
}

function RowIcon({ children, muted }: { children: ReactNode; muted?: boolean }) {
	return (
		<span
			className={cn(
				"inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-cell text-text-primary [&_svg]:size-[19px]",
				muted && "opacity-55",
			)}
			aria-hidden="true"
		>
			{children}
		</span>
	)
}

function Tag({ children, off }: { children: ReactNode; off?: boolean }) {
	return (
		<span
			className={cn(
				"rounded-full px-2 py-[3px] text-[11.5px] leading-none font-medium not-italic",
				off ? "bg-cell text-text-muted" : "bg-brand-subtle text-brand-text",
			)}
		>
			{children}
		</span>
	)
}

function PlanCard({
	subscription,
	onReload,
	isReloading,
}: {
	subscription: ReadyAccountOverview["subscription"]
	onReload: () => void
	isReloading: boolean
}) {
	const status = subscription.available ? subscription.status : null
	const state = status ? resolvePlanState(status) : "unavailable"
	const copy = planCopy[state]
	const line = getPlanLine(state, status)

	return (
		<section
			className="mt-9 rounded-[22px] bg-bg-elevated p-6 shadow-[var(--site-ring),0_1px_2px_rgba(28,25,23,0.04)] max-sm:p-5"
			aria-label={accountCopy.planLabel}
		>
			<div className="flex items-center justify-between gap-5 max-sm:flex-col max-sm:items-stretch">
				<div className="min-w-0">
					<StatusBadge color={toneColors[copy.tone]} size="lg">
						{copy.pill}
					</StatusBadge>
					<h2 className="mt-3 mb-1 text-[24px] leading-[1.2] font-semibold tracking-[-0.02em]">
						{copy.title}
					</h2>
					<span className="text-[15px] leading-[1.4] text-text-secondary">{line}</span>
				</div>
				{copy.action === "billing" ? (
					<Button className="shrink-0 max-sm:h-11" asChild>
						<a href={accountCopy.billingHref}>
							{copy.cta}
							<ArrowRight aria-hidden="true" />
						</a>
					</Button>
				) : null}
				{copy.action === "reload" ? (
					<Button
						className="shrink-0 max-sm:h-11"
						variant="secondary"
						type="button"
						onClick={onReload}
						disabled={isReloading}
					>
						{copy.cta}
						{isReloading ? <Spinner aria-label="Refreshing" /> : <RefreshCw aria-hidden="true" />}
					</Button>
				) : null}
			</div>
			{copy.body ? (
				<p className="mt-4 mb-0 border-sep border-t pt-4 text-[14.5px] leading-[1.55] text-pretty text-text-secondary">
					{copy.body}
				</p>
			) : null}
		</section>
	)
}

function UnavailableNotice({ message }: { message: string }) {
	return (
		<Alert className="rounded-[18px] border-0 bg-transparent px-5 py-4 text-text-secondary shadow-[inset_0_0_0_1px_var(--site-sep)]">
			<AlertDescription className="text-[14px] leading-[1.5]">{message}</AlertDescription>
		</Alert>
	)
}

function VaultsSection({ vaults }: { vaults: ReadyAccountOverview["vaults"] }) {
	return (
		<section className="mt-11" aria-labelledby="account-vaults">
			<SectionHeading
				id="account-vaults"
				title={accountCopy.vaultsTitle}
				count={vaults.available ? String(vaults.vaults.length) : undefined}
			/>
			{!vaults.available ? (
				<UnavailableNotice message={vaults.message} />
			) : vaults.vaults.length === 0 ? (
				<div className="flex flex-col gap-1 rounded-[18px] p-[22px] shadow-[inset_0_0_0_1px_var(--site-sep)]">
					<b className="text-[15px] leading-[1.3] font-medium">{accountCopy.emptyVaultsTitle}</b>
					<span className="text-[14px] leading-[1.5] text-text-secondary">
						{accountCopy.emptyVaultsBody}
					</span>
				</div>
			) : (
				<ul className={listClass}>
					{vaults.vaults.map((vault) => (
						<li key={`${vault.name}-${vault.role}-${vault.updatedAt}`} className={rowClass}>
							<RowIcon>
								<Vault />
							</RowIcon>
							<div className="min-w-0 flex-1">
								<b className="flex items-center gap-2 text-[15px] leading-[1.3] font-medium">
									{vault.name}
								</b>
								<span className="mt-[3px] block truncate text-[13.5px] leading-[1.35] text-text-muted max-sm:whitespace-normal">
									{getVaultMeta(vault)}
								</span>
							</div>
							{vaultRoleLabels[vault.role] ? (
								<span className="shrink-0 text-[13.5px] leading-none font-medium text-text-secondary max-sm:hidden">
									{vaultRoleLabels[vault.role]}
								</span>
							) : null}
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

function DeviceIcon({ type }: { type: string }) {
	const kind = getDeviceKind(type)
	if (kind === "mobile") return <Smartphone />
	if (kind === "web") return <Globe />
	return <Laptop />
}

function DevicesSection({
	devices,
	onRevoke,
	onSignOutEverywhere,
}: {
	devices: ReadyAccountOverview["devices"]
	onRevoke: (device: AccountDeviceSummary) => void
	onSignOutEverywhere: () => Promise<void>
}) {
	const [askingId, setAskingId] = useState<string | null>(null)
	const [isAskingAll, setIsAskingAll] = useState(false)
	const [isSigningOutAll, setIsSigningOutAll] = useState(false)
	const activeCount = devices.available ? devices.devices.filter((d) => !d.isRevoked).length : 0

	return (
		<section className="mt-11" aria-labelledby="account-devices">
			<SectionHeading
				id="account-devices"
				title={accountCopy.devicesTitle}
				count={devices.available ? accountCopy.devicesCount(activeCount) : undefined}
			/>
			{!devices.available ? (
				<UnavailableNotice message={devices.message} />
			) : (
				<ul className={listClass}>
					{devices.devices.map((device) => {
						const isAsking = askingId === device.id
						const canSignOut = !device.isCurrent && !device.isRevoked && !isAsking
						return (
							<li key={device.id} className={cn(rowClass, isAsking && "bg-bg-secondary")}>
								<RowIcon muted={device.isRevoked}>
									<DeviceIcon type={device.type} />
								</RowIcon>
								<div className="min-w-0 flex-1">
									<b className="flex flex-wrap items-center gap-2 text-[15px] leading-[1.3] font-medium">
										<span className={cn(device.isRevoked && "opacity-55")}>{device.name}</span>
										{device.isCurrent ? <Tag>{accountCopy.thisDevice}</Tag> : null}
										{device.isRevoked ? <Tag off>{accountCopy.signedOut}</Tag> : null}
									</b>
									<span className="mt-[3px] block truncate text-[13.5px] leading-[1.35] text-text-muted max-sm:whitespace-normal">
										{getDeviceMeta(device)}
									</span>
								</div>
								{canSignOut ? (
									<Button
										className={smallButton}
										variant="ghost"
										type="button"
										aria-label={`${accountCopy.signOut} ${device.name}`}
										onClick={() => {
											setIsAskingAll(false)
											setAskingId(device.id)
										}}
									>
										{accountCopy.signOut}
									</Button>
								) : null}
								{isAsking ? (
									<div
										className="flex basis-full items-center gap-2 pl-[54px] max-sm:flex-wrap max-sm:pl-0"
										role="alertdialog"
										aria-label={`${accountCopy.signOut} ${device.name}`}
									>
										<span className="flex-1 text-[13.5px] leading-[1.4] text-text-secondary max-sm:basis-full">
											{accountCopy.signOutConfirm}
										</span>
										<Button
											className={smallButton}
											variant="ghost"
											type="button"
											onClick={() => setAskingId(null)}
										>
											{accountCopy.cancel}
										</Button>
										<Button
											className={smallButton}
											variant="destructive"
											type="button"
											onClick={() => {
												setAskingId(null)
												onRevoke(device)
											}}
										>
											{accountCopy.signOut}
										</Button>
									</div>
								) : null}
							</li>
						)
					})}
				</ul>
			)}
			<div className="mt-3 flex items-center gap-2 pr-1 pl-4 max-sm:flex-col max-sm:items-stretch max-sm:p-0">
				{isAskingAll ? (
					<>
						<span className="flex-1 text-[13.5px] leading-[1.4] text-text-muted" role="alert">
							<b className="font-medium text-text-primary">{accountCopy.allConfirmTitle}</b>{" "}
							{accountCopy.allConfirmBody}
						</span>
						<Button
							className={smallButton}
							variant="ghost"
							type="button"
							onClick={() => setIsAskingAll(false)}
							disabled={isSigningOutAll}
						>
							{accountCopy.cancel}
						</Button>
						<Button
							className={smallButton}
							variant="destructive"
							type="button"
							disabled={isSigningOutAll}
							onClick={() => {
								setIsSigningOutAll(true)
								void onSignOutEverywhere().finally(() => setIsSigningOutAll(false))
							}}
						>
							{isSigningOutAll ? <Spinner aria-label="Signing out" /> : null}
							{accountCopy.allConfirmAction}
						</Button>
					</>
				) : (
					<>
						<span className="flex-1 text-[13.5px] leading-[1.4] text-text-muted">
							{accountCopy.allIdle}
						</span>
						<Button
							className={cn(
								smallButton,
								"text-status-error hover:bg-status-error-background hover:text-status-error",
							)}
							variant="ghost"
							type="button"
							onClick={() => {
								setAskingId(null)
								setIsAskingAll(true)
							}}
						>
							{accountCopy.allAction}
						</Button>
					</>
				)}
			</div>
		</section>
	)
}

function AccountSkeleton() {
	return (
		<div aria-hidden="true">
			<div className="flex items-center gap-4">
				<Skeleton className="size-14 rounded-full bg-cell max-sm:size-12" />
				<div className="grid flex-1 gap-2">
					<Skeleton className="h-8 w-40 bg-cell" />
					<Skeleton className="h-4 w-56 bg-cell" />
				</div>
			</div>
			<Skeleton className="mt-9 h-[148px] rounded-[22px] bg-cell" />
			<Skeleton className="mt-11 h-6 w-44 bg-cell" />
			<Skeleton className="mt-3.5 h-[136px] rounded-[18px] bg-cell" />
			<Skeleton className="mt-11 h-6 w-36 bg-cell" />
			<Skeleton className="mt-3.5 h-[204px] rounded-[18px] bg-cell" />
		</div>
	)
}

export function AccountPage({
	getOverview = defaultGetOverview,
	initialOverview,
	logoutAction = defaultLogoutAction,
	revokeAction = defaultRevokeAction,
	redirectTo = defaultRedirectTo,
}: AccountPageProps) {
	const [state, setState] = useState<AccountState>(
		initialOverview
			? {
					state: "ready",
					overview: {
						...initialOverview,
						devices: initialOverview.devices.available
							? {
									...initialOverview.devices,
									devices: sortDevices(initialOverview.devices.devices),
								}
							: initialOverview.devices,
					},
				}
			: { state: "loading" },
	)
	const [isReloading, setIsReloading] = useState(false)
	const [isLoggingOut, setIsLoggingOut] = useState(false)
	const hasLoadedRef = useRef(Boolean(initialOverview))

	const loadOverview = useCallback(async () => {
		try {
			const overview = await getOverview()
			if (!overview.authenticated) {
				setState({ state: "redirecting", redirectTo: overview.redirectTo })
				redirectTo(overview.redirectTo)
				return
			}
			setState({
				state: "ready",
				overview: {
					...overview,
					devices: overview.devices.available
						? { ...overview.devices, devices: sortDevices(overview.devices.devices) }
						: overview.devices,
				},
			})
		} catch {
			setState({ state: "error", message: "Cortex Sync is temporarily unavailable." })
		}
	}, [getOverview, redirectTo])

	useEffect(() => {
		if (hasLoadedRef.current) return
		hasLoadedRef.current = true
		void loadOverview()
	}, [loadOverview])

	const reload = useCallback(() => {
		setIsReloading(true)
		void loadOverview().finally(() => setIsReloading(false))
	}, [loadOverview])

	const updateDevices = useCallback(
		(update: (devices: AccountDeviceSummary[]) => AccountDeviceSummary[]) => {
			setState((current) => {
				if (current.state !== "ready" || !current.overview.devices.available) return current
				return {
					state: "ready",
					overview: {
						...current.overview,
						devices: {
							available: true,
							devices: sortDevices(update(current.overview.devices.devices)),
						},
					},
				}
			})
		},
		[],
	)

	const handleRevoke = useCallback(
		(device: AccountDeviceSummary) => {
			updateDevices((devices) =>
				devices.map((item) => (item.id === device.id ? { ...item, isRevoked: true } : item)),
			)

			const rollback = () =>
				updateDevices((devices) =>
					devices.map((item) => (item.id === device.id ? { ...item, isRevoked: false } : item)),
				)

			void revokeAction({ data: { deviceId: device.id } })
				.then((result) => {
					if (result.ok) {
						trackEvent({ name: "device_revoked" })
						return
					}
					rollback()
					if (result.code === "unauthenticated") {
						redirectTo(result.redirectTo)
						return
					}
					toast.error(accountCopy.signOutFailed(device.name))
				})
				.catch(() => {
					rollback()
					toast.error(accountCopy.signOutFailed(device.name))
				})
		},
		[redirectTo, revokeAction, updateDevices],
	)

	const handleSignOutEverywhere = useCallback(async () => {
		try {
			await logoutAction({ data: { allDevices: true } })
			trackEvent({ name: "signed_out_everywhere" })
			redirectTo("/login")
		} catch {
			toast.error(accountCopy.allFailed)
		}
	}, [logoutAction, redirectTo])

	const handleLogout = useCallback(async () => {
		setIsLoggingOut(true)
		try {
			await logoutAction({ data: {} })
		} finally {
			redirectTo("/login?redirect=/account")
		}
	}, [logoutAction, redirectTo])

	return (
		<div className="mx-auto w-[min(760px,calc(100%-64px))] pt-16 max-sm:w-[calc(100%-40px)] max-sm:pt-8">
			<Toaster
				toastOptions={{
					classNames: {
						toast:
							"flex items-center gap-3 rounded-xl bg-text-primary py-2.5 pr-2 pl-3.5 text-[13px] leading-[1.3] font-medium text-bg-primary shadow-floating",
					},
				}}
			/>
			{state.state === "loading" ? <AccountSkeleton /> : null}
			{state.state === "redirecting" ? (
				<div className="grid justify-items-center gap-3 py-24 text-center" aria-live="polite">
					<Spinner className="size-5 text-text-muted" />
					<h1 className="m-0 text-[24px] leading-[1.25] font-semibold tracking-[-0.02em]">
						{accountCopy.redirecting}
					</h1>
				</div>
			) : null}
			{state.state === "error" ? (
				<div className="grid justify-items-center gap-4 py-24 text-center" role="alert">
					<h1 className="m-0 text-[24px] leading-[1.25] font-semibold tracking-[-0.02em]">
						{accountCopy.title}
					</h1>
					<p className="m-0 text-[15px] text-text-secondary">{state.message}</p>
					<Button variant="secondary" type="button" onClick={reload} disabled={isReloading}>
						{planCopy.unavailable.cta}
						<RefreshCw aria-hidden="true" />
					</Button>
				</div>
			) : null}
			{state.state === "ready" ? (
				<>
					<header className="flex items-center gap-4 max-sm:flex-wrap max-sm:gap-3">
						<span
							className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[22px] leading-none font-semibold text-brand-text max-sm:size-12 max-sm:text-[19px]"
							aria-hidden="true"
						>
							{getInitial(state.overview.session.email)}
						</span>
						<div className="min-w-0 flex-1">
							<h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] max-sm:text-[26px]">
								{accountCopy.title}
							</h1>
							<span className="mt-1 block truncate text-[15px] leading-[1.3] text-text-secondary">
								{state.overview.session.email}
							</span>
						</div>
						<Button
							className="shrink-0 max-sm:order-3 max-sm:h-11 max-sm:w-full"
							variant="secondary"
							type="button"
							onClick={() => void handleLogout()}
							disabled={isLoggingOut}
						>
							{isLoggingOut ? (
								<Spinner aria-label={accountCopy.loggingOut} />
							) : (
								<LogOut aria-hidden="true" />
							)}
							{accountCopy.logOut}
						</Button>
					</header>
					<PlanCard
						subscription={state.overview.subscription}
						onReload={reload}
						isReloading={isReloading}
					/>
					<VaultsSection vaults={state.overview.vaults} />
					<DevicesSection
						devices={state.overview.devices}
						onRevoke={handleRevoke}
						onSignOutEverywhere={handleSignOutEverywhere}
					/>
					<p className="mt-12 mb-0 text-[13.5px] leading-[1.5] text-text-muted">
						{accountCopy.footer}{" "}
						<a
							className="rounded-sm text-text-secondary underline underline-offset-2 outline-none hover:text-text-primary focus-visible:shadow-focus"
							href={accountCopy.footerHref}
						>
							{accountCopy.footerLink}
						</a>
					</p>
				</>
			) : null}
		</div>
	)
}
