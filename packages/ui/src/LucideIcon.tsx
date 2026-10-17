import {
	BookOpenIcon,
	CalendarIcon,
	CopyIcon,
	FileIcon,
	type LucideIcon as LucideIconComponent,
	SearchIcon,
	SmileIcon,
	Trash2Icon,
	TrashIcon,
	TriangleAlertIcon,
} from "lucide-react"
import { type SVGAttributes, useEffect, useReducer } from "react"
import { type LucideIconName, resolveLucideIconName } from "./lucide-icon-utils"

interface Props extends SVGAttributes<SVGSVGElement> {
	name: LucideIconName | string
	size?: number | string
}

type IconModule = Record<string, LucideIconComponent>

const STATIC_ICONS: Record<string, LucideIconComponent> = {
	"book-open": BookOpenIcon,
	calendar: CalendarIcon,
	copy: CopyIcon,
	file: FileIcon,
	search: SearchIcon,
	smile: SmileIcon,
	trash: TrashIcon,
	"trash-2": Trash2Icon,
	"triangle-alert": TriangleAlertIcon,
}

let iconModule: IconModule | null = null
let iconModulePromise: Promise<IconModule> | null = null

function loadIconModule(): Promise<IconModule> {
	iconModulePromise ??= import("./lucide-lazy-icons").then((module) => {
		iconModule = module.lazyLucideIcons as IconModule
		return iconModule
	})
	return iconModulePromise
}

function lookupIcon(name: LucideIconName): LucideIconComponent | null {
	const staticIcon = STATIC_ICONS[name]
	if (staticIcon) return staticIcon
	return iconModule?.[name] ?? null
}

export function LucideIcon({ name, size = 16, ...rest }: Props) {
	const resolved = resolveLucideIconName(name)
	const Icon = resolved ? lookupIcon(resolved) : null
	const [, rerender] = useReducer((count: number) => count + 1, 0)

	useEffect(() => {
		if (Icon || !resolved || iconModule) return
		let active = true
		void loadIconModule().then(() => {
			if (active) rerender()
		})
		return () => {
			active = false
		}
	}, [Icon, resolved])

	if (!Icon) return null
	return <Icon size={size} {...rest} />
}
