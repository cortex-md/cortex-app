import { Link } from "expo-router"

import type { EntryContextMenuProps } from "@/features/file-explorer/entryContextMenuTypes"

export function EntryContextMenu({
	children,
	groups,
	header,
	href,
	onPress,
}: EntryContextMenuProps) {
	if (groups.length === 0) return children({ onPress })
	return (
		<Link
			asChild
			href={href}
			onPress={(event) => {
				event.preventDefault()
				onPress()
			}}
		>
			<Link.Trigger>{children({})}</Link.Trigger>
			<Link.Menu title={header}>
				{groups.map((group, index) => (
					<Link.Menu inline key={group[0]?.key ?? index}>
						{group.map((item) => (
							<Link.MenuAction
								destructive={item.destructive}
								disabled={item.disabled}
								icon={item.icon?.sf}
								isOn={item.checked}
								key={item.key}
								onPress={item.onPress}
								subtitle={item.subtitle}
								title={item.label}
							/>
						))}
					</Link.Menu>
				))}
			</Link.Menu>
		</Link>
	)
}
