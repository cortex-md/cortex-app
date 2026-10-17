import type { DOMProps } from "expo/dom"
import {
	memo,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { type LayoutChangeEvent, StyleSheet, View } from "react-native"
import WorkspaceWebView from "@/features/workspace/WorkspaceWebView"
import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import type { WorkspaceViewHandle } from "@/features/workspace/workspaceProtocol"

const domProps: DOMProps = {
	automaticallyAdjustContentInsets: false,
	bounces: false,
	containerStyle: { flex: 1 },
	contentInsetAdjustmentBehavior: "never",
	hideKeyboardAccessoryView: true,
	keyboardDisplayRequiresUserAction: false,
	overScrollMode: "never",
	scrollEnabled: false,
	useExpoDOMWebView: false,
}

const WorkspaceWebViewFrame = memo(function WorkspaceWebViewFrame({
	viewRef,
}: {
	viewRef: RefObject<WorkspaceViewHandle | null>
}) {
	return <WorkspaceWebView dom={domProps} ref={viewRef} send={workspaceChannel.receive} />
})

function reportChromeHeight(event: LayoutChangeEvent): void {
	workspaceChannel.setBottomInset(event.nativeEvent.layout.height)
}

/** The one persistent workspace WebView, laid over the focused note's placeholder rectangle. */
export function WorkspaceHost() {
	const viewRef = useRef<WorkspaceViewHandle>(null)
	const containerRef = useRef<View>(null)
	const [origin, setOrigin] = useState({ x: 0, y: 0 })
	const { owner, rect, visible } = useSyncExternalStore(
		workspaceChannel.subscribeLayout,
		workspaceChannel.getLayout,
	)
	const chrome = useSyncExternalStore(workspaceChannel.subscribeChrome, workspaceChannel.getChrome)
	const shown = visible && rect !== null
	const frame = rect
		? {
				height: rect.height,
				left: rect.x - origin.x,
				top: rect.y - origin.y,
				width: rect.width,
			}
		: null

	const measureOrigin = useCallback(() => {
		containerRef.current?.measureInWindow((x, y) => {
			setOrigin((current) => (current.x === x && current.y === y ? current : { x, y }))
		})
	}, [])

	useEffect(() => workspaceChannel.attach(viewRef), [])

	useEffect(() => {
		if (rect) measureOrigin()
	}, [measureOrigin, rect])

	return (
		<View
			collapsable={false}
			onLayout={measureOrigin}
			pointerEvents="box-none"
			ref={containerRef}
			style={StyleSheet.absoluteFill}
		>
			<View
				pointerEvents={shown ? "auto" : "none"}
				style={[frame ?? StyleSheet.absoluteFill, styles.layer, !shown && styles.hidden]}
			>
				<WorkspaceWebViewFrame viewRef={viewRef} />
			</View>
			{shown && frame && chrome.owner === owner && chrome.node ? (
				<View pointerEvents="box-none" style={[frame, styles.layer, styles.chromeFrame]}>
					<View onLayout={reportChromeHeight} pointerEvents="box-none">
						{chrome.node}
					</View>
				</View>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	chromeFrame: {
		justifyContent: "flex-end",
	},
	hidden: {
		opacity: 0,
	},
	layer: {
		position: "absolute",
	},
})
