import { FilledIconButton, Host, RNHostView } from "@expo/ui/jetpack-compose"

import { SymbolIcon } from "@/components/ui/Symbol"
import type { SendButtonProps } from "@/features/comments/sendButtonTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function SendButton({ disabled, onPress }: SendButtonProps) {
	const { colors } = useMobileColors()
	return (
		<Host matchContents>
			<FilledIconButton enabled={!disabled} onClick={onPress}>
				<RNHostView matchContents>
					<SymbolIcon
						color={disabled ? colors.disabled : colors.onTint}
						name={{ sf: "paperplane.fill", md: "send" }}
						size={22}
					/>
				</RNHostView>
			</FilledIconButton>
		</Host>
	)
}
