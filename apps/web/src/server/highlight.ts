import { createServerFn } from "@tanstack/react-start"
import { pluginCode } from "../content/landing"

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

const pluginCodeHtml = `<pre class="shiki cortex-shiki" style="background-color: transparent;"><code>${pluginCode
	.split("\n")
	.map((line) => `<span class="line">${escapeHtml(line)}</span>`)
	.join("")}</code></pre>`

export const getPluginCodeHtml = createServerFn({ method: "GET" }).handler(() => pluginCodeHtml)
