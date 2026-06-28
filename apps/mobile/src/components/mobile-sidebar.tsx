import {
	getNotePathPresentation,
	useAppStore,
	useEditorStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import type { FileEntry, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	ChevronRight,
	Menu,
	Plus,
	Search,
	Settings,
	FileText,
	Folder,
	FolderOpen,
	X,
} from "lucide-react-native"
import { useRouter } from "expo-router"
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	type ColorValue,
	useColorScheme,
	useWindowDimensions,
	View,
} from "react-native"
import DrawerLayout from "react-native-gesture-handler/DrawerLayout"

import { getMobileColorScheme, mobileColors, mobileIconColors } from "@/theme/colors"

interface MobileSidebarContextValue {
	closeSidebar: () => void
	openSidebar: () => void
}

interface SidebarFileRow {
	depth: number
	entry: FileEntry
}

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null)

export function useMobileSidebar(): MobileSidebarContextValue {
	const context = useContext(MobileSidebarContext)
	if (!context) {
		throw new Error("useMobileSidebar must be used inside MobileSidebarProvider")
	}

	return context
}

function getParentPath(path: string): string {
	const normalizedPath = path.replace(/\/+$/u, "")
	return normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
}

function buildSidebarRows(
	files: FileEntry[],
	vaultPath: string | null,
	expandedFolders: ReadonlySet<string>,
): SidebarFileRow[] {
	if (!vaultPath) return []

	const childrenByParent = new Map<string, FileEntry[]>()
	for (const file of files) {
		const parentPath = getParentPath(file.path)
		const children = childrenByParent.get(parentPath) ?? []
		children.push(file)
		childrenByParent.set(parentPath, children)
	}

	const rows: SidebarFileRow[] = []
	const appendChildren = (parentPath: string, depth: number) => {
		for (const child of childrenByParent.get(parentPath) ?? []) {
			rows.push({ depth, entry: child })
			if (child.isDir && expandedFolders.has(child.path)) {
				appendChildren(child.path, depth + 1)
			}
		}
	}

	appendChildren(vaultPath, 0)
	return rows
}

function getVaultInitial(entry: VaultRegistryEntry | null): string {
	return (entry?.name ?? "Cortex").trim().slice(0, 1).toUpperCase() || "C"
}

function SidebarToggleIcon({ color }: { color: string }) {
	return <Menu color={color} size={22} strokeWidth={2.25} />
}

export function SidebarToggleButton({ color }: { color?: string }) {
	const scheme = getMobileColorScheme(useColorScheme())
	const iconColors = mobileIconColors[scheme]
	const { openSidebar } = useMobileSidebar()

	return (
		<Pressable
			accessibilityLabel="Open sidebar"
			hitSlop={8}
			onPress={openSidebar}
			style={({ pressed }) => [styles.headerIconButton, { opacity: pressed ? 0.52 : 1 }]}
		>
			<SidebarToggleIcon color={color ?? iconColors.tint} />
		</Pressable>
	)
}

export function MobileSidebarProvider({ children }: PropsWithChildren) {
	const drawerRef = useRef<DrawerLayout>(null)
	const router = useRouter()
	const { width } = useWindowDimensions()
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const iconColors = mobileIconColors[scheme]
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const openVault = useVaultStore((state) => state.openVault)
	const closeVault = useVaultStore((state) => state.closeVault)
	const loadRecentVaults = useVaultStore((state) => state.loadRecentVaults)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const setActiveFile = useEditorStore((state) => state.setActiveFile)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const markFirstRunOnboardingSeen = useAppStore((state) => state.markFirstRunOnboardingSeen)
	const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<string>>(() => new Set())
	const drawerWidth = Math.min(Math.max(width * 0.84, 300), 380)
	const rows = useMemo(
		() => buildSidebarRows(files, vault?.path ?? null, expandedFolders),
		[expandedFolders, files, vault?.path],
	)
	const activeRecent = useMemo(
		() => recentVaults.find((entry) => entry.uuid === vault?.uuid) ?? recentVaults[0] ?? null,
		[recentVaults, vault?.uuid],
	)

	const closeSidebar = useCallback(() => {
		drawerRef.current?.closeDrawer()
	}, [])

	const openSidebar = useCallback(() => {
		drawerRef.current?.openDrawer()
	}, [])

	const handleOpenNote = useCallback(
		(filePath: string) => {
			openTab(filePath, { reuseActive: true })
			setActiveFile(filePath)
			closeSidebar()
			router.push({
				params: { filePath },
				pathname: "/(notes)/note" as never,
			})
		},
		[closeSidebar, openTab, router, setActiveFile],
	)

	const handleToggleFolder = useCallback((folderPath: string) => {
		setExpandedFolders((current) => {
			const next = new Set(current)
			if (next.has(folderPath)) next.delete(folderPath)
			else next.add(folderPath)
			return next
		})
	}, [])

	const handleOpenRecentVault = useCallback(
		async (entry: VaultRegistryEntry) => {
				if (vault?.uuid !== entry.uuid) {
					await closeVault()
					await openVault(entry.path, {
						color: entry.color ?? undefined,
						icon: entry.icon ?? undefined,
						name: entry.name,
					})
				}
			await markFirstRunOnboardingSeen()
			await loadRecentVaults()
			closeSidebar()
			router.replace("/(notes)" as never)
		},
		[closeSidebar, closeVault, loadRecentVaults, markFirstRunOnboardingSeen, openVault, router, vault?.uuid],
	)

	const handleOpenPickedVault = useCallback(async () => {
		const path = await getPlatform().dialog.pickFolder()
		if (!path) return
		await closeVault()
		await openVault(path, { createOnboardingNote: true })
		await markFirstRunOnboardingSeen()
		await loadRecentVaults()
		closeSidebar()
		router.replace("/(notes)" as never)
	}, [closeSidebar, closeVault, loadRecentVaults, markFirstRunOnboardingSeen, openVault, router])

	const renderSidebar = () => (
		<View style={[styles.sidebar, { backgroundColor: colors.groupedBackground }]}>
			<View style={styles.sidebarHeader}>
				<View style={[styles.vaultGlyph, { backgroundColor: colors.tint }]}>
					<Text style={styles.vaultGlyphText}>{getVaultInitial(activeRecent)}</Text>
				</View>
				<View style={styles.vaultHeaderText}>
					<Text numberOfLines={1} style={[styles.vaultName, { color: colors.label }]}>
						{vault?.name ?? activeRecent?.name ?? "Cortex"}
					</Text>
					<Text numberOfLines={1} style={[styles.vaultPath, { color: colors.secondaryLabel }]}>
						{vault?.displayPath ?? activeRecent?.displayPath ?? "No vault open"}
					</Text>
				</View>
				<Pressable
					accessibilityLabel="Close sidebar"
					hitSlop={8}
					onPress={closeSidebar}
					style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.52 : 1 }]}
				>
					<X color={iconColors.secondary} size={20} strokeWidth={2.25} />
				</Pressable>
			</View>

			<View style={styles.quickActions}>
				<SidebarDestination
					Icon={FolderOpen}
					color={iconColors.tint}
					label="Files"
					onPress={() => {
						closeSidebar()
						router.push("/(notes)" as never)
					}}
					textColor={colors.label}
				/>
				<SidebarDestination
					Icon={Search}
					color={iconColors.tint}
					label="Search"
					onPress={() => {
						closeSidebar()
						router.push("/(search)" as never)
					}}
					textColor={colors.label}
				/>
				<SidebarDestination
					Icon={Settings}
					color={iconColors.tint}
					label="Settings"
					onPress={() => {
						closeSidebar()
						router.push("/(settings)" as never)
					}}
					textColor={colors.label}
				/>
			</View>

			<View style={styles.sidebarSectionHeader}>
				<Text style={[styles.sectionLabel, { color: colors.secondaryLabel }]}>Files</Text>
				<Pressable
					accessibilityLabel="Open vault folder"
					hitSlop={8}
					onPress={() => {
						void handleOpenPickedVault()
					}}
					style={({ pressed }) => [styles.compactIconButton, { opacity: pressed ? 0.52 : 1 }]}
				>
					<Plus color={iconColors.tint} size={18} strokeWidth={2.3} />
				</Pressable>
			</View>

			<FlatList
				contentContainerStyle={styles.fileListContent}
				data={rows}
				keyExtractor={(item) => item.entry.path}
				ListEmptyComponent={
					<Text style={[styles.emptySidebarText, { color: colors.secondaryLabel }]}>
						Open a vault to see files.
					</Text>
				}
				renderItem={({ item }) => (
					<SidebarFileItem
						active={activeFilePath === item.entry.path}
						colors={colors}
						depth={item.depth}
						entry={item.entry}
						expanded={expandedFolders.has(item.entry.path)}
						iconColors={iconColors}
						onOpenNote={handleOpenNote}
						onToggleFolder={handleToggleFolder}
						vaultPath={vault?.path}
					/>
				)}
				style={styles.fileList}
			/>

			<View style={[styles.recentSection, { borderColor: colors.separator }]}>
				<Text style={[styles.sectionLabel, { color: colors.secondaryLabel }]}>Recent Vaults</Text>
				{recentVaults.slice(0, 4).map((entry) => (
					<Pressable
						key={entry.uuid}
						onPress={() => {
							void handleOpenRecentVault(entry)
						}}
						style={({ pressed }) => [styles.recentRow, { opacity: pressed ? 0.6 : 1 }]}
					>
						<Text numberOfLines={1} style={[styles.recentName, { color: colors.label }]}>
							{entry.name}
						</Text>
						<Text numberOfLines={1} style={[styles.recentPath, { color: colors.secondaryLabel }]}>
							{entry.displayPath ?? entry.path}
						</Text>
					</Pressable>
				))}
			</View>
		</View>
	)

	return (
		<MobileSidebarContext.Provider value={{ closeSidebar, openSidebar }}>
			<DrawerLayout
				ref={drawerRef}
				drawerBackgroundColor="transparent"
				drawerLockMode="unlocked"
				drawerPosition="left"
				drawerType="front"
				drawerWidth={drawerWidth}
				edgeWidth={28}
				keyboardDismissMode="on-drag"
				overlayColor="rgba(0,0,0,0.28)"
				renderNavigationView={renderSidebar}
				useNativeAnimations
			>
				{children}
			</DrawerLayout>
		</MobileSidebarContext.Provider>
	)
}

function SidebarDestination({
	Icon,
	color,
	label,
	onPress,
	textColor,
}: {
	Icon: typeof FolderOpen
	color: string
	label: string
	onPress: () => void
	textColor: ColorValue
}) {
	return (
		<Pressable onPress={onPress} style={({ pressed }) => [styles.destination, { opacity: pressed ? 0.58 : 1 }]}>
			<Icon color={color} size={20} strokeWidth={2.25} />
			<Text style={[styles.destinationLabel, { color: textColor }]}>{label}</Text>
		</Pressable>
	)
}

function SidebarFileItem({
	active,
	colors,
	depth,
	entry,
	expanded,
	iconColors,
	onOpenNote,
	onToggleFolder,
	vaultPath,
}: {
	active: boolean
	colors: (typeof mobileColors)[keyof typeof mobileColors]
	depth: number
	entry: FileEntry
	expanded: boolean
	iconColors: (typeof mobileIconColors)[keyof typeof mobileIconColors]
	onOpenNote: (filePath: string) => void
	onToggleFolder: (folderPath: string) => void
	vaultPath?: string
}) {
	const title = entry.isDir
		? entry.name
		: getNotePathPresentation(entry.path, vaultPath).title || entry.name
	const Icon = entry.isDir ? (expanded ? FolderOpen : Folder) : FileText

	return (
		<Pressable
			onPress={() => {
				if (entry.isDir) onToggleFolder(entry.path)
				else onOpenNote(entry.path)
			}}
			style={({ pressed }) => [
				styles.fileRow,
				{
					backgroundColor: active ? colors.secondaryBackground : "transparent",
					marginLeft: depth * 14,
					opacity: pressed ? 0.58 : 1,
				},
			]}
		>
			{entry.isDir ? (
				<ChevronRight
					color={iconColors.secondary}
					size={15}
					style={[styles.disclosure, expanded ? styles.disclosureOpen : null]}
				/>
			) : (
				<View style={styles.disclosurePlaceholder} />
			)}
			<Icon color={active ? iconColors.tint : iconColors.secondary} size={18} strokeWidth={2.15} />
			<Text numberOfLines={1} style={[styles.fileRowText, { color: colors.label }]}>
				{title}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	closeButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 36,
		minWidth: 36,
	},
	compactIconButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 32,
		minWidth: 32,
	},
	destination: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 12,
		minHeight: 42,
		paddingHorizontal: 12,
	},
	destinationLabel: {
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
	},
	disclosure: {
		transform: [{ rotate: "0deg" }],
	},
	disclosureOpen: {
		transform: [{ rotate: "90deg" }],
	},
	disclosurePlaceholder: {
		width: 15,
	},
	emptySidebarText: {
		fontSize: 14,
		lineHeight: 20,
		paddingHorizontal: 12,
		paddingVertical: 12,
	},
	fileList: {
		flex: 1,
	},
	fileListContent: {
		paddingBottom: 8,
	},
	fileRow: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 8,
		minHeight: 36,
		paddingHorizontal: 10,
	},
	fileRowText: {
		flex: 1,
		fontSize: 15,
		fontWeight: "500",
		letterSpacing: 0,
		lineHeight: 20,
		minWidth: 0,
	},
	headerIconButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 32,
		minWidth: 32,
	},
	quickActions: {
		gap: 4,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	recentName: {
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 18,
	},
	recentPath: {
		fontSize: 12,
		letterSpacing: 0,
		lineHeight: 16,
	},
	recentRow: {
		gap: 2,
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: 12,
	},
	recentSection: {
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 4,
		paddingHorizontal: 12,
		paddingTop: 12,
		paddingBottom: 18,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 16,
		textTransform: "uppercase",
	},
	sidebar: {
		flex: 1,
		paddingTop: 56,
	},
	sidebarHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	sidebarSectionHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 14,
		paddingBottom: 4,
		paddingTop: 8,
	},
	vaultGlyph: {
		alignItems: "center",
		borderRadius: 8,
		height: 38,
		justifyContent: "center",
		width: 38,
	},
	vaultGlyphText: {
		color: "#ffffff",
		fontSize: 17,
		fontWeight: "800",
		letterSpacing: 0,
		lineHeight: 22,
	},
	vaultHeaderText: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	vaultName: {
		fontSize: 17,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 22,
	},
	vaultPath: {
		fontSize: 12,
		letterSpacing: 0,
		lineHeight: 16,
	},
})
