import { Button } from "@cortex/ui/button"
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router"
import { noIndexRobots } from "../../seo/metadata"

export function RouteErrorPage({ reset }: ErrorComponentProps) {
	const router = useRouter()

	return (
		<section
			className="mx-auto flex w-[min(560px,calc(100%-40px))] flex-col items-center pt-32 text-center max-sm:pt-20"
			role="alert"
		>
			<meta name="robots" content={noIndexRobots} />
			<h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] max-sm:text-[30px]">
				Something went wrong.
			</h1>
			<p className="mt-4 text-[17px] leading-[1.55] text-text-secondary">
				This page couldn’t load. Try again in a moment.
			</p>
			<div className="mt-8 flex flex-wrap justify-center gap-2.5 max-sm:w-full max-sm:flex-col">
				<Button
					size="lg"
					onClick={() => {
						reset()
						void router.invalidate()
					}}
				>
					Try again
				</Button>
				<Button size="lg" variant="secondary" asChild>
					<a href="/">Go to the home page</a>
				</Button>
			</div>
		</section>
	)
}
