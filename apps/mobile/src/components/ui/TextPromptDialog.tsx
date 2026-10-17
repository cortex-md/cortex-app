import { type RefObject, useEffect, useRef } from "react"
import { Alert } from "react-native"

import type { TextPromptDialogProps } from "@/components/ui/dialogTypes"

interface PromptController {
	latest: RefObject<TextPromptDialogProps>
	showing: RefObject<boolean>
	value: RefObject<string>
}

function recheck(controller: PromptController): void {
	const props = controller.latest.current
	if (props.visible && props.error && !controller.showing.current) presentPrompt(controller)
}

function presentPrompt(controller: PromptController): void {
	const props = controller.latest.current
	controller.showing.current = true
	Alert.prompt(
		props.title,
		props.error ?? props.message,
		[
			{
				onPress: () => {
					controller.showing.current = false
					controller.latest.current.onCancel()
				},
				style: "cancel",
				text: props.cancelLabel ?? "Cancel",
			},
			{
				isPreferred: true,
				onPress: (text?: string) => {
					controller.showing.current = false
					const value = (text ?? "").trim()
					controller.value.current = value
					if (!value) {
						presentPrompt(controller)
						return
					}
					controller.latest.current.onChangeText?.(value)
					controller.latest.current.onConfirm(value)
					setTimeout(() => recheck(controller), 400)
				},
				text: props.confirmLabel,
			},
		],
		"plain-text",
		controller.value.current,
	)
}

export function TextPromptDialog(props: TextPromptDialogProps) {
	const latest = useRef(props)
	const showing = useRef(false)
	const value = useRef(props.initialValue ?? "")
	const wasVisible = useRef(false)
	const { error, visible } = props

	useEffect(() => {
		latest.current = props
	})

	useEffect(() => {
		const controller = { latest, showing, value }
		if (!visible) {
			wasVisible.current = false
			return
		}
		if (!wasVisible.current) {
			wasVisible.current = true
			value.current = latest.current.initialValue ?? ""
			presentPrompt(controller)
			return
		}
		if (error && !showing.current) presentPrompt(controller)
	}, [error, visible])

	return null
}
