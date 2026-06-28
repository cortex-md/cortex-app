interface PluginCodeBlockProps {
	highlightedHtml: string
}

const desktopCodeFontFamily = 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

// biome-ignore-start lint/security/noDangerouslySetInnerHtml: Shiki HTML is generated on the server from a local static snippet.
export function PluginCodeBlock({ highlightedHtml }: PluginCodeBlockProps) {
	return (
		<figure className="mx-auto my-0 w-fit max-w-full overflow-hidden rounded-xl bg-[#101010] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.22)]">
			<figcaption className="sr-only">
				Example plugin source showing Markdown transforms, commands, and sidebar views.
			</figcaption>
			<div className="overflow-x-auto px-[clamp(24px,4vw,44px)] py-[clamp(18px,2.4vw,26px)]">
				<div
					className="text-[14px] leading-[21px] text-white/80 [&_.cortex-shiki]:m-0 [&_.cortex-shiki]:overflow-visible [&_.cortex-shiki]:bg-transparent [&_.cortex-shiki]:text-[14px] [&_.cortex-shiki]:leading-[21px] [&_.line:empty]:h-[21px] [&_.line]:block [&_code]:flex [&_code]:flex-col [&_code]:whitespace-pre"
					data-highlighted-code="plugin-api"
					style={{ fontFamily: desktopCodeFontFamily }}
					dangerouslySetInnerHTML={{ __html: highlightedHtml }}
				/>
			</div>
		</figure>
	)
}
// biome-ignore-end lint/security/noDangerouslySetInnerHtml: Shiki HTML block ends.
