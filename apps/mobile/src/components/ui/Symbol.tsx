import { type AndroidSymbol, type SFSymbol, SymbolView } from "expo-symbols"
import type { ColorValue, StyleProp, ViewStyle } from "react-native"

export interface SymbolName {
	sf: SFSymbol
	md: AndroidSymbol
}

export function SymbolIcon({
	color,
	name,
	size = 22,
	style,
}: {
	color?: ColorValue
	name: SymbolName
	size?: number
	style?: StyleProp<ViewStyle>
}) {
	return (
		<SymbolView
			name={{ ios: name.sf, android: name.md }}
			size={size}
			style={style}
			tintColor={color}
		/>
	)
}
