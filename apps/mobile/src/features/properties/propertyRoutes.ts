import { type Href, router } from "expo-router"

import type { PropertyRouteName } from "@/features/properties/propertyPresentation"

type PropertyRouteParams = { key?: string; optionId?: string }

function propertyHref(name: PropertyRouteName, params?: PropertyRouteParams): Href {
	const pathname: string = `/properties/${name}`
	return { params, pathname } as Href
}

export function pushPropertyRoute(name: PropertyRouteName, params?: PropertyRouteParams): void {
	router.push(propertyHref(name, params))
}

export function replacePropertyRoute(name: PropertyRouteName, params?: PropertyRouteParams): void {
	router.replace(propertyHref(name, params))
}

export function popPropertyRoute(): void {
	if (router.canGoBack()) router.back()
}
