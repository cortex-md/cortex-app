"use client"

import Fuse from "fuse.js"
import { dynamicIconImports } from "lucide-react/dynamic"
import type * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useDebounceValue } from "usehooks-ts"
import { Button } from "./button"
import { Icon, type IconName } from "./icon-picker-icon"
import { IconPickerPanel } from "./icon-picker-panel"
import type { IconData, IconPickerPopoverVisibility } from "./icon-picker-types"
import { filterIconData, groupIconData } from "./icon-picker-utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export type { IconData } from "./icon-picker-types"

interface IconPickerProps
	extends Omit<React.ComponentPropsWithoutRef<typeof PopoverTrigger>, "onSelect" | "onOpenChange"> {
	ref?: React.Ref<React.ComponentRef<typeof PopoverTrigger>>
	value?: IconName
	defaultValue?: IconName
	onValueChange?: (value: IconName) => void
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	searchable?: boolean
	searchPlaceholder?: string
	triggerPlaceholder?: string
	iconsList?: IconData[]
	categorized?: boolean
	modal?: boolean
}

const useIconsData = (enabled: boolean) => {
	const [icons, setIcons] = useState<IconData[]>([])

	useEffect(() => {
		if (!enabled) return
		let isMounted = true

		const loadIcons = async () => {
			const { iconsData } = await import("./icons-data")
			if (isMounted) {
				setIcons(
					iconsData.filter((icon: IconData) => {
						return icon.name in dynamicIconImports
					}),
				)
			}
		}

		loadIcons()

		return () => {
			isMounted = false
		}
	}, [enabled])

	return { icons }
}

function IconPicker({
	ref,
	value,
	defaultValue,
	onValueChange,
	open,
	defaultOpen,
	onOpenChange,
	children,
	searchable = true,
	searchPlaceholder = "Search for an icon...",
	triggerPlaceholder = "Select an icon",
	iconsList,
	categorized = true,
	modal = false,
	...props
}: IconPickerProps) {
	const [selectedIcon, setSelectedIcon] = useState<IconName | undefined>(defaultValue)
	const [isOpen, setIsOpen] = useState(defaultOpen || false)
	const [search, setSearch] = useDebounceValue("", 100)
	const [popoverVisibility, setPopoverVisibility] = useState<IconPickerPopoverVisibility>({
		open: false,
		version: 0,
	})
	const { icons } = useIconsData(!iconsList)

	const iconsToUse = useMemo(() => iconsList || icons, [iconsList, icons])

	const fuseInstance = useMemo(() => {
		return new Fuse(iconsToUse, {
			keys: ["name", "tags", "categories"],
			threshold: 0.3,
			ignoreLocation: true,
			includeScore: true,
		})
	}, [iconsToUse])

	const filteredIcons = useMemo(() => {
		return filterIconData(iconsToUse, fuseInstance, search)
	}, [search, iconsToUse, fuseInstance])

	const categorizedIcons = useMemo(() => {
		return groupIconData(filteredIcons, categorized, search)
	}, [filteredIcons, categorized, search])

	const handleValueChange = useCallback(
		(icon: IconName) => {
			if (value === undefined) {
				setSelectedIcon(icon)
			}
			onValueChange?.(icon)
		},
		[value, onValueChange],
	)

	const handleOpenChange = useCallback(
		(newOpen: boolean) => {
			setSearch("")
			if (open === undefined) {
				setIsOpen(newOpen)
			}
			onOpenChange?.(newOpen)

			setPopoverVisibility((current) => ({
				open: newOpen,
				version: newOpen ? current.version + 1 : current.version,
			}))
		},
		[open, onOpenChange, setSearch],
	)

	const handleIconClick = useCallback(
		(iconName: IconName) => {
			handleValueChange(iconName)
			setIsOpen(false)
			setSearch("")
		},
		[handleValueChange, setSearch],
	)

	return (
		<Popover open={open ?? isOpen} onOpenChange={handleOpenChange} modal={modal}>
			<PopoverTrigger ref={ref} asChild {...props}>
				{children || (
					<Button variant="outline">
						{value || selectedIcon ? (
							<>
								<Icon name={(value || selectedIcon)!} /> {value || selectedIcon}
							</>
						) : (
							triggerPlaceholder
						)}
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent className="w-64 p-2">
				<IconPickerPanel
					searchable={searchable}
					searchPlaceholder={searchPlaceholder}
					categorized={categorized}
					search={search}
					setSearch={setSearch}
					filteredIcons={filteredIcons}
					categorizedIcons={categorizedIcons}
					popoverVisibility={popoverVisibility}
					onIconClick={handleIconClick}
				/>
			</PopoverContent>
		</Popover>
	)
}

export { IconPicker, Icon, type IconName }
