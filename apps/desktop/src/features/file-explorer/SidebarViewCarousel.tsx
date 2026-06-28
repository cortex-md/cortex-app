import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	LucideIcon,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import { LayoutGridIcon } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useInternalDragSource } from "../split-view/useInternalDragSource"
import {
	calculateSidebarViewScrollLeft,
	getSidebarViewLabelMaxWidth,
	type SidebarViewItem,
} from "./sidebarViewUtils"

interface SidebarViewCarouselProps {
	items: SidebarViewItem[]
	activeId: string
	onSelect: (id: string) => void
}

interface SidebarViewTabProps {
	item: SidebarViewItem
	isActive: boolean
	buttonRef: (element: HTMLButtonElement | null) => void
	onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
	onSelect: (id: string) => void
}

function SidebarViewIcon({ item }: { item: SidebarViewItem }) {
	return typeof item.icon === "string" ? (
		<LucideIcon name={item.icon} size={16} strokeWidth={2} />
	) : (
		<item.icon size={16} strokeWidth={2} />
	)
}

function SidebarViewTab({ item, isActive, buttonRef, onKeyDown, onSelect }: SidebarViewTabProps) {
	const dragProps = useInternalDragSource(
		() => ({
			type: "sidebar-view",
			viewId: item.viewId ?? item.id,
			viewTitle: item.label,
		}),
		{ disabled: item.draggable === false },
	)
	const button = (
		<Button
			ref={buttonRef}
			variant="ghost"
			type="button"
			role="tab"
			id={`sidebar-view-tab-${item.id}`}
			aria-controls="sidebar-view-panel"
			aria-label={item.label}
			aria-selected={isActive}
			data-active={isActive}
			data-label-visible={isActive}
			tabIndex={isActive ? 0 : -1}
			className="sidebar-view-tab"
			onKeyDown={onKeyDown}
			onClick={() => {
				if (!isActive) onSelect(item.id)
			}}
			{...dragProps}
		>
			<SidebarViewIcon item={item} />
			{isActive && (
				<span className="sidebar-view-tab-label">
					<span>{item.label}</span>
				</span>
			)}
		</Button>
	)

	if (isActive) return button

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={6}>
				{item.label}
			</TooltipContent>
		</Tooltip>
	)
}

export function SidebarViewCarousel({ items, activeId, onSelect }: SidebarViewCarouselProps) {
	const [pickerOpen, setPickerOpen] = useState(false)
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
	const navigationRef = useRef<HTMLElement>(null)
	const viewportRef = useRef<HTMLDivElement>(null)
	const animationFrameRef = useRef<number | null>(null)

	const alignItem = useCallback(
		(id: string, behavior: ScrollBehavior) => {
			const viewport = viewportRef.current
			const activeIndex = items.findIndex((item) => item.id === id)
			if (!viewport || activeIndex === -1) return

			const buttons = buttonRefs.current.map((button) => ({
				left: button?.offsetLeft ?? 0,
				width: button?.offsetWidth ?? 0,
			}))
			const styles = window.getComputedStyle(viewport)
			const left = calculateSidebarViewScrollLeft({
				activeIndex,
				buttons,
				viewportWidth: viewport.clientWidth,
				scrollWidth: viewport.scrollWidth,
				paddingStart: Number.parseFloat(styles.paddingInlineStart) || 0,
				paddingEnd: Number.parseFloat(styles.paddingInlineEnd) || 0,
			})

			viewport.scrollTo({ left, behavior })
		},
		[items],
	)

	useEffect(() => {
		const navigation = navigationRef.current
		if (!navigation || typeof ResizeObserver === "undefined") return

		const updateLabelMaxWidth = (width: number) => {
			const nextWidth = getSidebarViewLabelMaxWidth(width)
			navigation.style.setProperty("--sidebar-active-label-max-width", `${nextWidth}px`)
		}
		updateLabelMaxWidth(navigation.clientWidth)
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? navigation.clientWidth
			updateLabelMaxWidth(width)
		})
		observer.observe(navigation)

		return () => observer.disconnect()
	}, [])

	const scheduleAlignment = useCallback(
		(id: string, behavior: ScrollBehavior) => {
			if (animationFrameRef.current !== null) {
				window.cancelAnimationFrame(animationFrameRef.current)
			}
			animationFrameRef.current = window.requestAnimationFrame(() => {
				alignItem(id, behavior)
				animationFrameRef.current = null
			})
		},
		[alignItem],
	)

	useLayoutEffect(() => {
		const behavior = document.body.dataset.reducedMotion === "true" ? "auto" : "smooth"
		scheduleAlignment(activeId, behavior)
	}, [activeId, scheduleAlignment])

	useEffect(() => {
		const viewport = viewportRef.current
		const activeIndex = items.findIndex((item) => item.id === activeId)
		const activeButton = buttonRefs.current[activeIndex]
		if (!viewport || !activeButton || typeof ResizeObserver === "undefined") return

		const observer = new ResizeObserver(() => scheduleAlignment(activeId, "auto"))
		observer.observe(viewport)
		for (const button of buttonRefs.current) {
			if (button) observer.observe(button)
		}

		return () => observer.disconnect()
	}, [activeId, items, scheduleAlignment])

	useEffect(
		() => () => {
			if (animationFrameRef.current !== null) {
				window.cancelAnimationFrame(animationFrameRef.current)
			}
		},
		[],
	)

	const focusItem = (index: number) => {
		const target = buttonRefs.current[index]
		target?.focus()
		const behavior = document.body.dataset.reducedMotion === "true" ? "auto" : "smooth"
		scheduleAlignment(items[index].id, behavior)
	}

	const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
		let targetIndex: number | null = null
		if (event.key === "ArrowLeft") targetIndex = index === 0 ? items.length - 1 : index - 1
		if (event.key === "ArrowRight") targetIndex = index === items.length - 1 ? 0 : index + 1
		if (event.key === "Home") targetIndex = 0
		if (event.key === "End") targetIndex = items.length - 1
		if (targetIndex === null) return
		event.preventDefault()
		focusItem(targetIndex)
	}

	const handlePickerSelect = (id: string) => {
		onSelect(id)
		setPickerOpen(false)
	}

	const coreItems = items.filter((item) => item.source === "core")
	const extensionItems = items.filter((item) => item.source === "extension")

	return (
		<TooltipProvider delayDuration={320}>
			<nav ref={navigationRef} className="sidebar-view-carousel" aria-label="Sidebar views">
				<div ref={viewportRef} className="sidebar-view-carousel-viewport" role="tablist">
					{items.map((item, index) => (
						<SidebarViewTab
							key={item.id}
							item={item}
							isActive={item.id === activeId}
							buttonRef={(element) => {
								buttonRefs.current[index] = element
							}}
							onKeyDown={(event) => handleKeyDown(index, event)}
							onSelect={onSelect}
						/>
					))}
				</div>
				<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									type="button"
									className="sidebar-view-picker-trigger"
									aria-label="All sidebar views"
								>
									<LayoutGridIcon size={16} strokeWidth={2} />
								</Button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent side="bottom" sideOffset={6}>
							All views
						</TooltipContent>
					</Tooltip>
					<PopoverContent
						align="end"
						side="bottom"
						sideOffset={8}
						className="sidebar-view-picker p-0"
					>
						<Command>
							<CommandInput placeholder="Find a view..." />
							<CommandList>
								<CommandEmpty>No views found.</CommandEmpty>
								<CommandGroup heading="Cortex">
									{coreItems.map((item) => (
										<CommandItem
											key={item.id}
											value={`${item.label} ${item.id}`}
											data-active={item.id === activeId}
											onSelect={() => handlePickerSelect(item.id)}
										>
											<SidebarViewIcon item={item} />
											<span>{item.label}</span>
										</CommandItem>
									))}
								</CommandGroup>
								{extensionItems.length > 0 && (
									<CommandGroup heading="Extensions">
										{extensionItems.map((item) => (
											<CommandItem
												key={item.id}
												value={`${item.label} ${item.id}`}
												data-active={item.id === activeId}
												onSelect={() => handlePickerSelect(item.id)}
											>
												<SidebarViewIcon item={item} />
												<span>{item.label}</span>
											</CommandItem>
										))}
									</CommandGroup>
								)}
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</nav>
		</TooltipProvider>
	)
}
