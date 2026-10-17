import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
	cn,
	SimpleTooltip,
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
		<AvatarGroup
			className={cn("user-facepile", className)}
			role="group"
			aria-label={label ?? users.map((user) => user.name).join(", ")}
		>
			{visible.map((user) => (
				<SimpleTooltip key={user.userId} label={user.name} side="bottom">
					<UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={size} />
				</SimpleTooltip>
			))}
			{hiddenUsers.length > 0 && (
				<SimpleTooltip label={hiddenUsers.map((user) => user.name).join(", ")} side="bottom">
					<AvatarGroupCount>+{hiddenUsers.length}</AvatarGroupCount>
				</SimpleTooltip>
			)}
		</AvatarGroup>
	)
}
