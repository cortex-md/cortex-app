import type { SplitTree } from "@cortex/core"
import type { ComponentType, ReactNode } from "react"
import { memo, useRef } from "react"

interface Props {
	node: SplitTree
	LeafComponent: ComponentType<SplitPaneLeafProps>
	onResize: (nodeId: string, sizes: number[]) => void
}

interface SplitPaneNodeProps extends Props {
	isStartPane: boolean
	isEndPane: boolean
}

export interface SplitPaneLeafProps {
	paneId: string
}

interface ResizerProps {
	direction: "horizontal" | "vertical"
	onDragMove: (totalDelta: number) => void
	onDragEnd: (totalDelta: number) => void
}

const MIN_SPLIT_SIZE_PERCENT = 10

function getPointerPosition(direction: ResizerProps["direction"], event: React.PointerEvent) {
	return direction === "horizontal" ? event.clientX : event.clientY
}

function Resizer({ direction, onDragMove, onDragEnd }: ResizerProps) {
	const startPosition = useRef<number | null>(null)

	const handlePointerDown = (event: React.PointerEvent) => {
		event.preventDefault()
		event.currentTarget.setPointerCapture(event.pointerId)
		startPosition.current = getPointerPosition(direction, event)
		document.body.style.userSelect = "none"
	}

	const handlePointerMove = (event: React.PointerEvent) => {
		if (startPosition.current === null) return
		onDragMove(getPointerPosition(direction, event) - startPosition.current)
	}

	const handlePointerEnd = (event: React.PointerEvent) => {
		if (startPosition.current === null) return
		const totalDelta = getPointerPosition(direction, event) - startPosition.current
		startPosition.current = null
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId)
		}
		document.body.style.userSelect = ""
		onDragEnd(totalDelta)
	}

	return (
		<div
			className={`split-resizer split-resizer--${direction}`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerEnd}
			onPointerCancel={handlePointerEnd}
			aria-hidden="true"
		/>
	)
}

function SplitPaneNode({
	node,
	LeafComponent,
	onResize,
	isStartPane,
	isEndPane,
}: SplitPaneNodeProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const childElementsRef = useRef<(HTMLDivElement | null)[]>([])

	if (node.type === "leaf") {
		return (
			<div
				className="split-leaf"
				data-split-start-pane={isStartPane ? "true" : undefined}
				data-split-end-pane={isEndPane ? "true" : undefined}
			>
				<LeafComponent paneId={node.id} />
			</div>
		)
	}

	const { direction, children, sizes } = node

	const getDraggedSizes = (index: number, totalDelta: number): number[] | null => {
		const container = containerRef.current
		if (!container || totalDelta === 0) return null
		const totalSize = direction === "horizontal" ? container.offsetWidth : container.offsetHeight
		if (totalSize <= 0) return null
		const minimumDelta = MIN_SPLIT_SIZE_PERCENT - sizes[index]
		const maximumDelta = sizes[index + 1] - MIN_SPLIT_SIZE_PERCENT
		const deltaPercent = Math.min(
			maximumDelta,
			Math.max(minimumDelta, (totalDelta / totalSize) * 100),
		)
		const nextSizes = [...sizes]
		nextSizes[index] += deltaPercent
		nextSizes[index + 1] -= deltaPercent
		return nextSizes
	}

	const applyChildSizes = (index: number, nextSizes: readonly number[]) => {
		for (const childIndex of [index, index + 1]) {
			const element = childElementsRef.current[childIndex]
			if (element) element.style.flex = String(nextSizes[childIndex] / 100)
		}
	}

	const handleDragMove = (index: number, totalDelta: number) => {
		applyChildSizes(index, getDraggedSizes(index, totalDelta) ?? sizes)
	}

	const handleDragEnd = (index: number, totalDelta: number) => {
		const nextSizes = getDraggedSizes(index, totalDelta)
		if (nextSizes) onResize(node.id, nextSizes)
		else applyChildSizes(index, sizes)
	}

	const elements: ReactNode[] = []
	for (let i = 0; i < children.length; i++) {
		const child = children[i]
		if (i > 0) {
			elements.push(
				<Resizer
					key={`resizer-${children[i - 1].id}-${child.id}`}
					direction={direction}
					onDragMove={(totalDelta) => handleDragMove(i - 1, totalDelta)}
					onDragEnd={(totalDelta) => handleDragEnd(i - 1, totalDelta)}
				/>,
			)
		}
		elements.push(
			<div
				key={child.id}
				ref={(element) => {
					childElementsRef.current[i] = element
				}}
				className="split-child"
				style={{ flex: sizes[i] / 100 }}
			>
				<SplitPaneNode
					node={child}
					LeafComponent={LeafComponent}
					onResize={onResize}
					isStartPane={isStartPane && i === 0}
					isEndPane={
						isEndPane && (direction === "horizontal" ? i === children.length - 1 : i === 0)
					}
				/>
			</div>,
		)
	}

	return (
		<div ref={containerRef} className={`split-container split-container--${direction}`}>
			{elements}
		</div>
	)
}

export const SplitPaneView = memo(function SplitPaneView(props: Props) {
	return <SplitPaneNode {...props} isStartPane={true} isEndPane={true} />
})
