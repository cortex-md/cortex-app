import { type RefObject, useEffect, useRef } from "react"
import { Alert, type AlertButton } from "react-native"

import type { ConfirmDialogProps } from "@/components/ui/dialogTypes"

function describe(props: ConfirmDialogProps, extra?: string): string | undefined {
	const lines = [
		props.message,
		props.impact?.map((cell) => `${cell.label}: ${cell.value}`).join("\n"),
		extra,
	].filter((line): line is string => Boolean(line))
	return lines.length > 0 ? lines.join("\n\n") : undefined
}

function presentConfirm(latest: RefObject<ConfirmDialogProps>, extra?: string): void {
	const props = latest.current
	const cancel: AlertButton = {
		onPress: () => latest.current.onCancel(),
		style: "cancel",
		text: props.cancelLabel ?? "Cancel",
	}
	const style = props.destructive ? "destructive" : "default"
	const typedName = props.typedName
	if (!typedName) {
		Alert.alert(props.title, describe(props), [
			cancel,
			{ onPress: () => latest.current.onConfirm(), style, text: props.confirmLabel },
		])
		return
	}
	Alert.prompt(
		props.title,
		describe(props, extra ?? `Type "${typedName}" to confirm.`),
		[
			cancel,
			{
				onPress: (value?: string) => {
					if (value?.trim() === typedName) latest.current.onConfirm()
					else presentConfirm(latest, `The name does not match. Type "${typedName}" to confirm.`)
				},
				style,
				text: props.confirmLabel,
			},
		],
		"plain-text",
	)
}

export function ConfirmDialog(props: ConfirmDialogProps) {
	const latest = useRef(props)
	const { visible } = props

	useEffect(() => {
		latest.current = props
	})

	useEffect(() => {
		if (visible) presentConfirm(latest)
	}, [visible])

	return null
}
