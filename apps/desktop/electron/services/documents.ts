import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import { BrowserWindow } from "electron"
import type { MainApi } from "../contract"
import { assertAllowedPath } from "../security"

async function exportHtmlToPdf(path: string, html: string, title: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true })
	const window = new BrowserWindow({
		show: false,
		webPreferences: {
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			javascript: false,
		},
	})

	try {
		const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`
		await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(documentHtml)}`)
		const pdf = await window.webContents.printToPDF({
			printBackground: true,
			margins: {
				top: 0.75,
				bottom: 0.75,
				left: 0.75,
				right: 0.75,
			},
		})
		await fs.writeFile(path, pdf)
	} finally {
		window.destroy()
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
}

export const documentsApi = {
	exportHtmlToPdf: async ({ targetPath, html, title }) =>
		await exportHtmlToPdf(assertAllowedPath(targetPath), html, title),
} satisfies MainApi["documents"]
