import type { DatabaseRowTemplate } from "@cortex/properties/database"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@cortex/ui"
import { ChevronDownIcon, FileTextIcon, PlusIcon, Table2Icon, TrashIcon } from "lucide-react"
import { formatCount } from "@/utils/format"
import { DatabaseTitleInput } from "./DatabaseTitleInput"

interface DatabaseHeaderProps {
	name: string
	count: number
	templates: DatabaseRowTemplate[]
	readOnly: boolean
	onCreate: (template: DatabaseRowTemplate | null) => void
	onRemoveTemplate: (templateId: string) => void
	onRename: (name: string) => Promise<unknown>
}

export function DatabaseHeader({
	name,
	count,
	templates,
	readOnly,
	onCreate,
	onRemoveTemplate,
	onRename,
}: DatabaseHeaderProps) {
	return (
		<header className="db-head">
			<span className="db-head-icon" aria-hidden="true">
				<Table2Icon />
			</span>
			<h1 className="db-head-title">
				<DatabaseTitleInput
					value={name}
					label="Database name"
					className="db-title-input"
					readOnly={readOnly}
					onRename={onRename}
				/>
			</h1>
			<span className="db-head-count">{formatCount(count, "note")}</span>
			<span className="flex-1" />
			{!readOnly && (
				<span className="db-new-split">
					<Button className="db-new-main" onClick={() => onCreate(null)}>
						<PlusIcon />
						New
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button className="db-new-more" aria-label="New from template">
								<ChevronDownIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="db-menu">
							<DropdownMenuLabel>Start from a template</DropdownMenuLabel>
							{templates.map((template) => (
								<DropdownMenuItem key={template.id} onSelect={() => onCreate(template)}>
									<FileTextIcon />
									{template.name}
								</DropdownMenuItem>
							))}
							<DropdownMenuItem onSelect={() => onCreate(null)}>
								<FileTextIcon />
								Blank note
							</DropdownMenuItem>
							{templates.length > 0 && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>Remove a template</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											{templates.map((template) => (
												<DropdownMenuItem
													key={template.id}
													variant="destructive"
													onSelect={() => onRemoveTemplate(template.id)}
												>
													<TrashIcon />
													{template.name}
												</DropdownMenuItem>
											))}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</span>
			)}
		</header>
	)
}
