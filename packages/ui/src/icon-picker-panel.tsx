"use client"

import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "./button"
import { type IconName, IconRenderer } from "./icon-picker-icon"
import type {
	CategorizedIconGroup,
	IconData,
	IconPickerPopoverVisibility,
} from "./icon-picker-types"
import { createCategoryIndices, createVirtualIconItems } from "./icon-picker-utils"
import { Input } from "./input"
import { cn } from "./lib/utils"
import { Skeleton } from "./skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

interface IconPickerPanelProps {
	searchable: boolean
	searchPlaceholder: string
	categorized: boolean
	search: string
	setSearch: (value: string) => void
	filteredIcons: IconData[]
	categorizedIcons: CategorizedIconGroup[]
	popoverVisibility: IconPickerPopoverVisibility
	onIconClick: (iconName: IconName) => void
}

const IconsColumnSkeleton = () => {
	return (
		<div className="flex flex-col gap-2 w-full">
			<Skeleton className="h-4 w-1/2 rounded-md" />
			<div className="grid grid-cols-5 gap-2 w-full">
				{Array.from({ length: 40 }).map((_, i) => (
					<Skeleton key={i} className="h-10 w-10 rounded-md" />
				))}
			</div>
		</div>
	)
}

function IconPickerCategoryNav({
	groups,
	onSelect,
}: {
	groups: CategorizedIconGroup[]
	onSelect: (categoryName: string) => void
}) {
	return (
		<div className="flex flex-row gap-1 mt-2 overflow-x-auto pb-2">
			{groups.map((category) => (
				<Button
					key={category.name}
					variant="outline"
					size="sm"
					className="text-xs"
					onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
						event.stopPropagation()
						onSelect(category.name)
					}}
				>
					{category.name.charAt(0).toUpperCase() + category.name.slice(1)}
				</Button>
			))}
		</div>
	)
}

function IconPickerIconButton({
	icon,
	onSelect,
}: {
	icon: IconData
	onSelect: (iconName: IconName) => void
}) {
	const iconName = icon.name as IconName

	return (
		<TooltipProvider key={icon.name}>
			<Tooltip>
				<TooltipTrigger
					className={cn(
						"p-2 rounded-md border hover:bg-foreground/10 transition",
						"flex items-center justify-center",
					)}
					onClick={() => onSelect(iconName)}
				>
					<IconRenderer name={iconName} />
				</TooltipTrigger>
				<TooltipContent>
					<p>{icon.name}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

function IconPickerPanel({
	searchable,
	searchPlaceholder,
	categorized,
	search,
	setSearch,
	filteredIcons,
	categorizedIcons,
	popoverVisibility,
	onIconClick,
}: IconPickerPanelProps) {
	const parentRef = React.useRef<HTMLDivElement>(null)
	const [measuredPopoverVersion, setMeasuredPopoverVersion] = useState(0)
	const virtualItems = useMemo(() => createVirtualIconItems(categorizedIcons), [categorizedIcons])
	const categoryIndices = useMemo(
		() => createCategoryIndices(virtualItems, categorizedIcons),
		[virtualItems, categorizedIcons],
	)
	const isPopoverLoading =
		popoverVisibility.open && measuredPopoverVersion !== popoverVisibility.version

	const virtualizer = useVirtualizer({
		count: virtualItems.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => (virtualItems[index].type === "category" ? 25 : 40),
		paddingEnd: 2,
		gap: 10,
		overscan: 5,
	})

	const handleSearchChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setSearch(event.target.value)
			if (parentRef.current) parentRef.current.scrollTop = 0
			virtualizer.scrollToOffset(0)
		},
		[setSearch, virtualizer],
	)

	const scrollToCategory = useCallback(
		(categoryName: string) => {
			const categoryIndex = categoryIndices[categoryName]
			if (categoryIndex !== undefined) {
				virtualizer.scrollToIndex(categoryIndex, {
					align: "start",
					behavior: "auto",
				})
			}
		},
		[categoryIndices, virtualizer],
	)

	useEffect(() => {
		if (!popoverVisibility.open) return

		const visibleVersion = popoverVisibility.version
		const timer = setTimeout(() => {
			setMeasuredPopoverVersion(visibleVersion)
			virtualizer.measure()
		}, 10)

		const resizeObserver = new ResizeObserver(() => {
			virtualizer.measure()
		})

		if (parentRef.current) resizeObserver.observe(parentRef.current)

		return () => {
			clearTimeout(timer)
			resizeObserver.disconnect()
		}
	}, [popoverVisibility.open, popoverVisibility.version, virtualizer])

	return (
		<>
			{searchable && (
				<Input
					size="sm"
					placeholder={searchPlaceholder}
					onChange={handleSearchChange}
					className="mb-2"
				/>
			)}
			{categorized && search.trim() === "" && (
				<IconPickerCategoryNav groups={categorizedIcons} onSelect={scrollToCategory} />
			)}
			<div ref={parentRef} className="max-h-60 overflow-auto" style={{ scrollbarWidth: "thin" }}>
				{isPopoverLoading ? (
					<IconsColumnSkeleton />
				) : (
					<IconPickerVirtualContent
						filteredIcons={filteredIcons}
						virtualItems={virtualItems}
						virtualizerItems={virtualizer.getVirtualItems()}
						totalSize={virtualizer.getTotalSize()}
						categorizedIcons={categorizedIcons}
						onIconClick={onIconClick}
					/>
				)}
			</div>
		</>
	)
}

function IconPickerVirtualContent({
	filteredIcons,
	virtualItems,
	virtualizerItems,
	totalSize,
	categorizedIcons,
	onIconClick,
}: {
	filteredIcons: IconData[]
	virtualItems: ReturnType<typeof createVirtualIconItems>
	virtualizerItems: VirtualItem[]
	totalSize: number
	categorizedIcons: CategorizedIconGroup[]
	onIconClick: (iconName: IconName) => void
}) {
	if (filteredIcons.length === 0) {
		return <div className="text-center text-gray-500">No icon found</div>
	}

	return (
		<div className="relative w-full overscroll-contain" style={{ height: `${totalSize}px` }}>
			{virtualizerItems.map((virtualItem) => {
				const item = virtualItems[virtualItem.index]
				if (!item) return null

				const itemStyle = {
					position: "absolute" as const,
					top: 0,
					left: 0,
					width: "100%",
					height: `${virtualItem.size}px`,
					transform: `translateY(${virtualItem.start}px)`,
				}

				if (item.type === "category") {
					return (
						<div key={virtualItem.key} style={itemStyle} className="top-0 bg-background z-10">
							<h3 className="font-medium text-sm capitalize">
								{categorizedIcons[item.categoryIndex].name}
							</h3>
							<div className="h-[1px] bg-foreground/10 w-full" />
						</div>
					)
				}

				return (
					<div key={virtualItem.key} data-index={virtualItem.index} style={itemStyle}>
						<div className="grid grid-cols-5 gap-2 w-full">
							{item.icons?.map((icon) => (
								<IconPickerIconButton key={icon.name} icon={icon} onSelect={onIconClick} />
							))}
						</div>
					</div>
				)
			})}
		</div>
	)
}

export { IconPickerPanel }
