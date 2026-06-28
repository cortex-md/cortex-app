export interface Http {
	fetch(url: string, options?: RequestInit): Promise<Response>

	download(url: string): Promise<string>
}
