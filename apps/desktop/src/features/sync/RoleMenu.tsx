import { roleInfo } from "@cortex/core/members"
import {
	Button,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@cortex/ui"
import { ChevronDownIcon } from "lucide-react"

interface RoleMenuProps {
	label: string
	value: string
	roles: readonly string[]
	disabled?: boolean
	className?: string
	onChange(role: string): void
}

export function RoleMenu({ label, value, roles, disabled, className, onChange }: RoleMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="xs"
					variant="secondary"
					className={cn("settings-role-pill", className)}
					aria-label={label}
					disabled={disabled}
				>
					{roleInfo(value).label}
					<ChevronDownIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="role-menu">
				<DropdownMenuRadioGroup value={value} onValueChange={onChange}>
					{roles.map((role) => {
						const info = roleInfo(role)
						return (
							<DropdownMenuRadioItem key={role} value={role} aria-label={info.label}>
								<span className="role-menu-copy">
									<span>{info.label}</span>
									{info.description && <small>{info.description}</small>}
								</span>
							</DropdownMenuRadioItem>
						)
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
