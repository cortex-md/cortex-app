import { getErrorMessage, useVaultStore } from "@cortex/core"
import { useGlobalSearchParams } from "expo-router"
import { createContext, type ReactNode, use, useMemo, useState } from "react"

import { toast } from "@/features/feedback/useToast"
import {
	copyShareLink,
	loadShareGroups,
	loadShareSubject,
	publishTemplate,
} from "@/features/share/shareAdapter"
import { FIXTURE_LISTING_NAME } from "@/features/share/shareFixtures"
import type {
	ShareAudience,
	ShareGroup,
	ShareSubject,
	ShareTemplateOutcome,
} from "@/features/share/shareTypes"

type Attempt = { ok: true; outcome: ShareTemplateOutcome } | { ok: false; error: string }

async function attemptPublish(...args: Parameters<typeof publishTemplate>): Promise<Attempt> {
	try {
		return { ok: true, outcome: await publishTemplate(...args) }
	} catch (error) {
		return { error: getErrorMessage(error), ok: false }
	}
}

async function attemptCopy(link: string): Promise<boolean> {
	try {
		await copyShareLink(link)
		return true
	} catch {
		return false
	}
}

function readParam(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

function useShareTemplateController() {
	const params = useGlobalSearchParams<{ folderPath?: string | string[] }>()
	const [folderPath] = useState(() => readParam(params.folderPath))
	const vaultName = useVaultStore((state) => state.vault?.name ?? "this vault")
	const subject = useMemo<ShareSubject>(() => loadShareSubject(folderPath), [folderPath])
	const groups = useMemo<ShareGroup[]>(() => loadShareGroups(vaultName), [vaultName])
	const [audience, setAudience] = useState<ShareAudience>("market")
	const [groupId, setGroupId] = useState<string | null>(() => groups[0]?.id ?? null)
	const [name, setName] = useState(() => (subject.folderPath ? subject.name : FIXTURE_LISTING_NAME))
	const [description, setDescription] = useState(subject.description)
	const [includeRowTemplates, setIncludeRowTemplates] = useState(true)
	const [includeSamples, setIncludeSamples] = useState(false)
	const [busy, setBusy] = useState(false)
	const [outcome, setOutcome] = useState<ShareTemplateOutcome | null>(null)
	const [copied, setCopied] = useState(false)

	const group = groups.find((item) => item.id === groupId) ?? groups[0]
	const groupName = group?.name ?? `Everyone in ${vaultName}`

	async function share(): Promise<boolean> {
		if (busy || !name.trim()) return false
		setBusy(true)
		const result = await attemptPublish(
			{
				audience,
				description: description.trim(),
				groupId: audience === "team" ? (group?.id ?? null) : null,
				includeRowTemplates,
				includeSamples,
				name: name.trim(),
				subject,
			},
			audience === "team" ? groupName : null,
		)
		setBusy(false)
		if (!result.ok) {
			toast(result.error)
			return false
		}
		setCopied(false)
		setOutcome(result.outcome)
		return true
	}

	async function copy(): Promise<void> {
		if (!outcome?.link) return
		const ok = await attemptCopy(outcome.link)
		setCopied(ok)
		toast(ok ? "Link copied" : "Couldn’t copy the link")
	}

	return {
		audience,
		busy,
		copied,
		copy,
		description,
		group,
		groupName,
		groups,
		includeRowTemplates,
		includeSamples,
		name,
		outcome,
		setAudience,
		setDescription,
		setGroupId,
		setIncludeRowTemplates,
		setIncludeSamples,
		setName,
		share,
		subject,
	}
}

export type ShareTemplateController = ReturnType<typeof useShareTemplateController>

const ShareTemplateContext = createContext<ShareTemplateController | null>(null)

export function ShareTemplateProvider({ children }: { children: ReactNode }) {
	const controller = useShareTemplateController()
	return <ShareTemplateContext value={controller}>{children}</ShareTemplateContext>
}

export function useShareTemplate(): ShareTemplateController {
	const controller = use(ShareTemplateContext)
	if (!controller) throw new Error("useShareTemplate must be used inside ShareTemplateProvider")
	return controller
}
