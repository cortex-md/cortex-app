export function urlencoded(value: string): string {
	return value
		.replaceAll("%", "%25")
		.replaceAll(" ", "%20")
		.replaceAll("#", "%23")
		.replaceAll("&", "%26")
		.replaceAll("?", "%3F")
}
