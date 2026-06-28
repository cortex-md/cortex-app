import type { ComponentType, ReactNode } from "react"
import { useRef } from "react"

export interface LeafNode {
	type: "leaf"
	id: string
}

export interface SplitNode {
	type: "split"
	id: string
	direction: "horizontal" | "vertical"
	children: SplitTree[]
	sizes: number[]
}

export type SplitTree = LeafNode | SplitNode

interface Props {
	node: SplitTree
	LeafComponent: ComponentType<SplitPaneLeafProps>
	onResize: (nodeId: string, sizes: number[]) => void
}

interface SplitPaneNodeProps extends Props {
	isStartPane: boolean
}

export interface SplitPaneLeafProps {
	paneId: string
}

interface ResizerProps {
	direction: "horizontal" | "vertical"
	onDrag: (delta: number) => void
}

function Resizer({ direction, onDrag }: ResizerProps) {
	const startPos = useRef(0)
	const dragging = useRef(false)

	const handlePointerDown = (e: React.PointerEvent) => {
		e.preventDefault()
		e.currentTarget.setPointerCapture(e.pointerId)
		startPos.current = direction === "horizontal" ? e.clientX : e.clientY
		dragging.current = true
		document.body.style.userSelect = "none"
	}

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!dragging.current) return
		const current = direction === "horizontal" ? e.clientX : e.clientY
		const delta = current - startPos.current
		if (delta !== 0) {
			onDrag(delta)
			startPos.current = current
		}
	}

	const handlePointerUp = (e: React.PointerEvent) => {
		if (!dragging.current) return
		dragging.current = false
		e.currentTarget.releasePointerCapture(e.pointerId)
		document.body.style.userSelect = ""
	}

	return (
		<div
			className={`split-resizer split-resizer--${direction}`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			aria-hidden="true"
		/>
	)
}

function SplitPaneNode({ node, LeafComponent, onResize, isStartPane }: SplitPaneNodeProps) {
	const containerRef = useRef<HTMLDivElement>(null)

	if (node.type === "leaf") {
		return (
			<div className="split-leaf" data-split-start-pane={isStartPane ? "true" : undefined}>
				<LeafComponent paneId={node.id} />
			</div>
		)
	}

	const { direction, children, sizes } = node

	const handleDrag = (index: number, delta: number) => {
		const container = containerRef.current
		if (!container) return
		const totalSize = direction === "horizontal" ? container.offsetWidth : container.offsetHeight
		const deltaPercent = (delta / totalSize) * 100
		const newSizes = [...sizes]
		newSizes[index] = Math.max(10, newSizes[index] + deltaPercent)
		newSizes[index + 1] = Math.max(10, newSizes[index + 1] - deltaPercent)
		onResize(node.id, newSizes)
	}

	const elements: ReactNode[] = []
	for (let i = 0; i < children.length; i++) {
		const child = children[i]
		if (i > 0) {
			elements.push(
				<Resizer
					key={`resizer-${children[i - 1].id}-${child.id}`}
					direction={direction}
					onDrag={(delta) => handleDrag(i - 1, delta)}
				/>,
			)
		}
		elements.push(
			<div key={child.id} className="split-child" style={{ flex: sizes[i] / 100 }}>
				<SplitPaneNode
					node={child}
					LeafComponent={LeafComponent}
					onResize={onResize}
					isStartPane={isStartPane && i === 0}
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

export function SplitPaneView(props: Props) {
	return <SplitPaneNode {...props} isStartPane={true} />
}
