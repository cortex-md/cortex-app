import { useMobileColors } from "@/hooks/useMobileColors"

export function useComposeListItemColors(disabled = false) {
	const { colors } = useMobileColors()
	return {
		containerColor: colors.cell,
		contentColor: disabled ? colors.disabled : colors.label,
		leadingContentColor: colors.secondaryLabel,
		supportingContentColor: colors.secondaryLabel,
		trailingContentColor: colors.secondaryLabel,
	}
}

export function useComposeSwitchColors() {
	const { colors } = useMobileColors()
	return {
		checkedBorderColor: colors.tintFill,
		checkedThumbColor: colors.onTint,
		checkedTrackColor: colors.tintFill,
		uncheckedBorderColor: colors.secondaryLabel,
		uncheckedThumbColor: colors.secondaryLabel,
		uncheckedTrackColor: colors.fill,
	}
}

export function useComposeSliderColors() {
	const { colors } = useMobileColors()
	return {
		activeTickColor: colors.onTint,
		activeTrackColor: colors.tintFill,
		inactiveTickColor: colors.secondaryLabel,
		inactiveTrackColor: colors.fill,
		thumbColor: colors.tintFill,
	}
}

export function useComposeTextFieldColors() {
	const { colors } = useMobileColors()
	return {
		cursorColor: colors.tintFill,
		focusedContainerColor: colors.cell,
		focusedIndicatorColor: colors.tintFill,
		focusedLabelColor: colors.tint,
		focusedPlaceholderColor: colors.placeholder,
		focusedSupportingTextColor: colors.secondaryLabel,
		focusedTextColor: colors.label,
		unfocusedContainerColor: colors.cell,
		unfocusedIndicatorColor: colors.border,
		unfocusedLabelColor: colors.secondaryLabel,
		unfocusedPlaceholderColor: colors.placeholder,
		unfocusedSupportingTextColor: colors.secondaryLabel,
		unfocusedTextColor: colors.label,
	}
}

export function useComposeSegmentedColors() {
	const { colors } = useMobileColors()
	return {
		activeBorderColor: colors.border,
		activeContainerColor: colors.accentSubtle,
		activeContentColor: colors.tint,
		inactiveBorderColor: colors.border,
		inactiveContainerColor: "transparent",
		inactiveContentColor: colors.secondaryLabel,
	}
}

export function useComposeRadioColors() {
	const { colors } = useMobileColors()
	return {
		disabledSelectedColor: colors.disabled,
		disabledUnselectedColor: colors.disabled,
		selectedColor: colors.tintFill,
		unselectedColor: colors.secondaryLabel,
	}
}
