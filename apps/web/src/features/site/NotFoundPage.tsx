import { Button } from "@cortex/ui/button"
import { noIndexRobots } from "../../seo/metadata"

export function NotFoundPage() {
	return (
		<section className="mx-auto flex w-[min(560px,calc(100%-40px))] flex-col items-center pt-32 text-center max-sm:pt-20">
			<meta name="robots" content={noIndexRobots} />
			<p className="text-[13px] leading-none font-medium text-text-muted">404</p>
			<h1 className="mt-4 text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] max-sm:text-[30px]">
				This page doesn’t exist.
			</h1>
			<p className="mt-4 text-[17px] leading-[1.55] text-text-secondary">
				The link may be old, or the page moved. Everything else is where you left it.
			</p>
			<div className="mt-8 flex flex-wrap justify-center gap-2.5 max-sm:w-full max-sm:flex-col">
				<Button size="lg" asChild>
					<a href="/">Go to the home page</a>
				</Button>
				<Button size="lg" variant="secondary" asChild>
					<a href="/docs">Read the docs</a>
				</Button>
			</div>
		</section>
	)
}
