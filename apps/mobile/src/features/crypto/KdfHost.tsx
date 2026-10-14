import type { DOMProps } from "expo/dom"
import { memo } from "react"
import { StyleSheet, View } from "react-native"

import KdfWebView from "@/features/crypto/KdfWebView"
import { attachKdfView, receiveKdfMessage } from "@/platform/kdfBridge"

const domProps: DOMProps = {
	containerStyle: { height: 1, width: 1 },
	scrollEnabled: false,
	useExpoDOMWebView: false,
}

export const KdfHost = memo(function KdfHost() {
	return (
		<View pointerEvents="none" style={styles.host}>
			<KdfWebView dom={domProps} ref={attachKdfView} send={receiveKdfMessage} />
		</View>
	)
})

const styles = StyleSheet.create({
	host: {
		height: 1,
		left: 0,
		opacity: 0,
		position: "absolute",
		top: 0,
		width: 1,
	},
})
