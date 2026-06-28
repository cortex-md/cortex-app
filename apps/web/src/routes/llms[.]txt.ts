import { createFileRoute } from "@tanstack/react-router"
import { createLlmsIndex } from "../features/docs/llms"

const textHeaders = {
	"content-type": "text/plain; charset=utf-8",
	"cache-control": "public, max-age=300",
}

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: async () =>
				new Response(createLlmsIndex(), {
					headers: textHeaders,
				}),
		},
	},
})
