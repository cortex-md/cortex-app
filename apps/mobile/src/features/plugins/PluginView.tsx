import {
	type ControlledPluginViewState,
	createPluginViewController,
	type RegisteredView,
	reportPluginOperationError,
} from "@cortex/plugin-host-core"
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	useEffect,
	useState,
	useSyncExternalStore,
} from "react"
import { ActivityIndicator } from "react-native"

import { PluginViewCrash, PluginViewDescriptor } from "@/features/plugins/PluginViewNodes"
import { useMobileColors } from "@/hooks/useMobileColors"

interface PluginViewProps extends Partial<ControlledPluginViewState> {
	registration: RegisteredView
}

const registrationRenderKeys = new WeakMap<RegisteredView, string>()
let nextRegistrationRenderKey = 0

function getRegistrationRenderKey(registration: RegisteredView): string {
	const existingKey = registrationRenderKeys.get(registration)
	if (existingKey) return existingKey
	const nextKey = `${registration.key}:${nextRegistrationRenderKey++}`
	registrationRenderKeys.set(registration, nextKey)
	return nextKey
}

interface PluginViewErrorBoundaryProps {
	owner: string
	viewKey: string
	children: ReactNode
}

class PluginViewErrorBoundary extends Component<
	PluginViewErrorBoundaryProps,
	{ error: Error | null }
> {
	state: { error: Error | null } = { error: null }

	static getDerivedStateFromError(error: Error) {
		return { error }
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		reportPluginOperationError(`render:${this.props.viewKey}`, this.props.owner, {
			message: error.message,
			componentStack: info.componentStack,
		})
	}

	render() {
		if (!this.state.error) return this.props.children
		return <PluginViewCrash message={this.state.error.message} />
	}
}

export function PluginView({ registration, state, onStateChange }: PluginViewProps) {
	return (
		<PluginViewErrorBoundary
			key={registration.key}
			owner={registration.owner}
			viewKey={registration.key}
		>
			<PluginViewContent
				key={getRegistrationRenderKey(registration)}
				registration={registration}
				state={state}
				onStateChange={onStateChange}
			/>
		</PluginViewErrorBoundary>
	)
}

function usePluginView({ registration, state, onStateChange }: PluginViewProps) {
	const [controller] = useState(() => createPluginViewController(registration, state))
	useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
	useEffect(() => controller.activate(), [controller])
	const controlled = state === undefined ? undefined : { state, onStateChange }
	return {
		view: controller.render(controlled),
		dispatch: (action: string, payload?: unknown) =>
			controller.dispatch(action, payload, controlled),
	}
}

function PluginViewContent(props: PluginViewProps) {
	const { view, dispatch } = usePluginView(props)
	const { colors } = useMobileColors()

	switch (view.status) {
		case "loading":
			return <ActivityIndicator color={colors.tint} />
		case "empty":
			return null
		case "error":
			return <PluginViewCrash message={view.error.message} />
		case "ready":
			return <PluginViewDescriptor descriptor={view.descriptor} dispatch={dispatch} />
	}
}
