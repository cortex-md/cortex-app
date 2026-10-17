import { Button } from "@cortex/ui/button"
import { MessageSquare } from "lucide-react"
import { marketplaceCopy } from "../../content/marketplace"
import { trackEvent } from "../../lib/analytics"
import type { DiscussionComment, DiscussionCommentsResult } from "../../server/discussions"
import type { MarketplaceItem } from "../../server/marketplace"
import { RenderedMarkdown } from "../docs/components/RenderedMarkdown"
import { formatDate } from "./marketplaceModel"

const copy = marketplaceCopy.comments

export function MarketplaceComments({
	item,
	comments,
	className,
}: {
	item: MarketplaceItem
	comments: DiscussionCommentsResult
	className?: string
}) {
	if (!item.discussionUrl) return null
	const discussionUrl = item.discussionUrl
	const repoOwner = item.repo.split("/")[0]?.toLowerCase()
	const commentBadge = (comment: DiscussionComment) =>
		comment.author.toLowerCase() === repoOwner
			? copy.author
			: comment.isMaintainer
				? copy.maintainer
				: null
	const openDiscussion = () =>
		trackEvent({ name: "marketplace_comment_clicked", kind: item.kind, id: item.id })

	return (
		<section className={className} aria-labelledby="marketplace-comments">
			<div className="mb-3.5 flex items-center justify-between gap-3">
				<h2
					id="marketplace-comments"
					className="flex items-center gap-2 text-[20px] leading-[1.25] font-semibold tracking-[-0.015em]"
				>
					{copy.title}
					{comments.total > 0 ? (
						<small className="text-[14px] leading-none font-medium text-text-muted tabular-nums">
							{comments.total}
						</small>
					) : null}
				</h2>
				<Button variant="secondary" size="sm" asChild>
					<a
						href={discussionUrl}
						target="_blank"
						rel="noopener noreferrer"
						onClick={openDiscussion}
					>
						<MessageSquare aria-hidden="true" />
						{copy.cta}
					</a>
				</Button>
			</div>

			{comments.comments.length === 0 ? (
				<p className="text-[14px] leading-normal text-text-secondary">
					{comments.status === "unavailable" ? copy.unavailable : copy.empty}
				</p>
			) : (
				<ol className="grid overflow-hidden rounded-2xl bg-bg-elevated shadow-ring">
					{comments.comments.map((comment) => (
						<li key={comment.id} className="border-sep border-t px-4 py-4 first:border-t-0">
							<div className="flex items-center gap-2.5 text-[13.5px] leading-none">
								{comment.avatarUrl ? (
									<img
										className="size-7 rounded-full bg-cell"
										src={comment.avatarUrl}
										alt=""
										width={28}
										height={28}
										loading="lazy"
										decoding="async"
										referrerPolicy="no-referrer"
									/>
								) : null}
								{comment.authorUrl ? (
									<a
										className="font-semibold text-text-primary underline-offset-[3px] hover:underline"
										href={comment.authorUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										{comment.author}
									</a>
								) : (
									<span className="font-semibold">{comment.author}</span>
								)}
								{commentBadge(comment) ? (
									<span className="rounded-full bg-cell px-2 py-1 text-[11.5px] font-medium text-text-secondary">
										{commentBadge(comment)}
									</span>
								) : null}
								<a
									className="ml-auto text-text-muted underline-offset-[3px] hover:underline"
									href={comment.url}
									target="_blank"
									rel="noopener noreferrer"
								>
									<time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
								</a>
							</div>
							<RenderedMarkdown
								className="markdown-surface docs-markdown mt-2.5 pl-[38px] text-[14.5px] max-sm:pl-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
								html={comment.bodyHtml}
							/>
							{comment.replies > 0 ? (
								<a
									className="mt-2 ml-[38px] inline-block text-[13px] leading-none font-medium text-text-secondary hover:text-text-primary max-sm:ml-0"
									href={comment.url}
									target="_blank"
									rel="noopener noreferrer"
								>
									{copy.replies(comment.replies)}
								</a>
							) : null}
						</li>
					))}
				</ol>
			)}

			{comments.total > comments.comments.length ? (
				<a
					className="mt-3 inline-block text-[14px] leading-none font-medium text-text-secondary underline underline-offset-[3px] hover:text-text-primary"
					href={discussionUrl}
					target="_blank"
					rel="noopener noreferrer"
					onClick={openDiscussion}
				>
					{copy.seeAll(comments.total)}
				</a>
			) : null}
		</section>
	)
}
