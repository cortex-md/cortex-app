import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
	cn,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import type { ComponentProps } from "react"
import { getInitials } from "@/utils/format"

type UserAvatarSize = "default" | "sm" | "lg"

interface UserAvatarProps extends Omit<ComponentProps<typeof Avatar>, "children" | "size"> {
	name: string
	avatarUrl?: string | null
	size?: UserAvatarSize
}

export function UserAvatar({
	name,
	avatarUrl,
	size = "default",
	className,
	...props
}: UserAvatarProps) {
	return (
		<Avatar size={size} className={cn("user-avatar", className)} {...props}>
			{avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
			<AvatarFallback>{getInitials(name)}</AvatarFallback>
		</Avatar>
	)
}

export interface FacepileUser {
	userId: string
	name: string
	avatarUrl: string | null
}

interface UserFacepileProps {
	users: readonly FacepileUser[]
	max?: number
	size?: UserAvatarSize
	className?: string
	label?: string
}

export function UserFacepile({ users, max = 3, size = "sm", className, label }: UserFacepileProps) {
	if (users.length === 0) return null
	const visible = users.slice(0, max)
	const hiddenUsers = users.slice(max)
	return (
		<TooltipProvider delayDuration={300} skipDelayDuration={150}>
			<AvatarGroup
				className={cn("user-facepile", className)}
				role="group"
				aria-label={label ?? users.map((user) => user.name).join(", ")}
			>
				{visible.map((user) => (
					<Tooltip key={user.userId}>
						<TooltipTrigger asChild>
							<UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={size} />
						</TooltipTrigger>
						<TooltipContent side="bottom" sideOffset={4}>
							{user.name}
						</TooltipContent>
					</Tooltip>
				))}
				{hiddenUsers.length > 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<AvatarGroupCount>+{hiddenUsers.length}</AvatarGroupCount>
						</TooltipTrigger>
						<TooltipContent side="bottom" sideOffset={4}>
							{hiddenUsers.map((user) => user.name).join(", ")}
						</TooltipContent>
					</Tooltip>
				)}
			</AvatarGroup>
		</TooltipProvider>
	)
}
