import { SELF_HOSTED_ENVIRONMENT_GROUPS, useTemplateStore } from "@cortex/core"
import {
	type RegisteredSettingsPage,
	resolvePluginSettingFields,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { SETTINGS_FIELDS, type SettingsSearchItem } from "@cortex/settings"
import { useMemo } from "react"

function pathFor(page: RegisteredSettingsPage | undefined, section?: string): string[] {
	const pageLabel = page?.title ?? page?.label
	if (!pageLabel) return section ? [section] : []
	return section && section !== pageLabel ? [pageLabel, section] : [pageLabel]
}

function buildPageItems(pages: readonly RegisteredSettingsPage[]): SettingsSearchItem[] {
	return pages.map((page) => ({
		id: `page:${page.key}`,
		pageKey: page.key,
		kind: "page",
		label: page.label,
		path: [page.group],
		description: page.description,
		keywords: page.title !== page.label ? [page.title] : undefined,
	}))
}

function buildFieldItems(pagesByKey: Map<string, RegisteredSettingsPage>): SettingsSearchItem[] {
	return SETTINGS_FIELDS.map((field) => ({
		id: field.id,
		pageKey: field.pageKey,
		kind: "field",
		label: field.label,
		path: pathFor(pagesByKey.get(field.pageKey), field.section),
		description: field.description,
		keywords: field.keywords,
	}))
}

function buildSelfHostedItems(
	pagesByKey: Map<string, RegisteredSettingsPage>,
): SettingsSearchItem[] {
	const page = pagesByKey.get("sync-self-host")
	return SELF_HOSTED_ENVIRONMENT_GROUPS.flatMap((group) =>
		group.sections.flatMap((section) =>
			section.fields.map((field) => ({
				id: `sync-self-host.env.${field.key}`,
				pageKey: "sync-self-host",
				kind: "field" as const,
				label: field.label,
				path: [...pathFor(page, "Environment"), group.label],
				description: field.key,
				keywords: [section.label, field.key],
				fallbackId: "sync-self-host.enabled",
			})),
		),
	)
}

function buildPluginFieldItems(pages: readonly RegisteredSettingsPage[]): SettingsSearchItem[] {
	return pages.flatMap((page) =>
		page.schema
			? resolvePluginSettingFields(page.schema, {}).map((field) => ({
					id: `plugin:${page.owner}.${field.key}`,
					pageKey: page.key,
					kind: "field" as const,
					label: field.label,
					path: [page.label],
					description: field.description,
				}))
			: [],
	)
}

export function useSettingsSearchItems(
	pages: readonly RegisteredSettingsPage[],
): SettingsSearchItem[] {
	const plugins = usePluginStore((state) => state.plugins)
	const templates = useTemplateStore((state) => state.templates)

	return useMemo(() => {
		const pagesByKey = new Map(pages.map((page) => [page.key, page]))
		const pluginItems: SettingsSearchItem[] = Object.values(plugins).map((record) => ({
			id: `plugins.${record.manifest.id}`,
			pageKey: "plugins",
			kind: "plugin",
			label: record.manifest.name,
			path: pathFor(
				pagesByKey.get("plugins"),
				record.community ? "Community plugins" : "Core plugins",
			),
			description: record.manifest.description,
			keywords: [record.manifest.author],
		}))
		const templateItems: SettingsSearchItem[] = templates.map((template) => ({
			id: `templates.${template.id}`,
			pageKey: "templates",
			kind: "template",
			label: template.name,
			path: pathFor(pagesByKey.get("templates")),
		}))
		return [
			...buildPageItems(pages),
			...buildFieldItems(pagesByKey),
			...buildSelfHostedItems(pagesByKey),
			...buildPluginFieldItems(pages),
			...pluginItems,
			...templateItems,
		]
	}, [pages, plugins, templates])
}
