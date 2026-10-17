"use dom"

import { argon2idAsync } from "@noble/hashes/argon2"
import { type DOMProps, useDOMImperativeHandle } from "expo/dom"
import { useEffect } from "react"

import type { KdfMessage, KdfRequest, KdfViewHandle } from "@/platform/kdfProtocol"

interface KdfWebViewProps {
	send: (message: KdfMessage) => Promise<void>
	ref?: Parameters<typeof useDOMImperativeHandle<KdfViewHandle>>[0]
	dom?: DOMProps
}

export default function KdfWebView({ send, ref }: KdfWebViewProps) {
	useDOMImperativeHandle<KdfViewHandle>(
		ref ?? null,
		() =>
			({
				derive: (request: KdfRequest) => {
					void argon2idAsync(request.password, Uint8Array.from(request.salt), {
						dkLen: request.hashLength,
						m: request.memoryCost,
						p: request.parallelism,
						t: request.timeCost,
					}).then(
						(hash) => send({ hash: Array.from(hash), id: request.id, type: "result" }),
						(error: unknown) =>
							send({
								id: request.id,
								message: error instanceof Error ? error.message : String(error),
								type: "error",
							}),
					)
				},
			}) as KdfViewHandle,
		[send],
	)

	useEffect(() => {
		void send({ type: "ready" })
	}, [send])

	return null
}
