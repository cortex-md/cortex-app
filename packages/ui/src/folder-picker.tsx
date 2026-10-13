"use client"

import { FileIcon, FolderIcon } from "lucide-react"
import { useCallback, useId, useMemo, useRef, useState } from "react"
import { Input } from "./input"
import { cn } from "./lib/utils"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"

export interface FolderPickerOption {
	value: string
	label: string
	isDir: boolean
}

interface FolderPickerProps {
	options: FolderPickerOption[]
	value: string
	onChange: (value: string) => void
	placeholder?: string
	className?: string
	allowCustomValue?: boolean
	getCustomValueLabel?: (value: string) => string
}

const MAX_VISIBLE_OPTIONS = 200

export function FolderPicker({
	options,
	value,
	onChange,
	placeholder = "Search folders...",
	className,
	allowCustomValue = false,
	getCustomValueLabel = (customValue) => `Add "${customValue}"`,
}: FolderPickerProps) {
	const [search, setSearch] = useState("")
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const anchorRef = useRef<HTMLDivElement>(null)
	const listboxId = useId()

	const filteredOptions = useMemo(() => {
		const lower = search.trim().toLowerCase()
		const matches = lower
			? options.filter((option) => option.label.toLowerCase().includes(lower))
			: options
		return matches.slice(0, MAX_VISIBLE_OPTIONS)
	}, [options, search])
	const trimmedSearch = search.trim()
	const exactOptionExists = useMemo(() => {
		if (!trimmedSearch) return false
		return options.some(
			(option) => option.value === trimmedSearch || option.label === trimmedSearch,
		)
	}, [options, trimmedSearch])
	const customValueAvailable = allowCustomValue && Boolean(trimmedSearch) && !exactOptionExists

	const handleSelect = useCallback(
		(optionValue: string) => {
			onChange(optionValue)
			setSearch("")
			setDropdownOpen(false)
			inputRef.current?.blur()
		},
		[onChange],
	)

	const handleCustomSelect = useCallback(() => {
		if (!trimmedSearch) return
		handleSelect(trimmedSearch)
	}, [handleSelect, trimmedSearch])

	const selectedLabel = options.find((o) => o.value === value)?.label
	const dropdownVisible =
		dropdownOpen && (filteredOptions.length > 0 || customValueAvailable || Boolean(trimmedSearch))

	const optionClassName =
		"flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-accent/70"

	return (
		<Popover open={dropdownVisible} onOpenChange={(open) => !open && setDropdownOpen(false)}>
			<PopoverAnchor asChild>
				<div ref={anchorRef} className={cn("relative", className)}>
					<Input
						ref={inputRef}
						role="combobox"
						aria-controls={listboxId}
						aria-expanded={dropdownVisible}
						aria-label={placeholder}
						value={dropdownOpen ? search : (selectedLabel ?? "")}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
							setSearch(e.target.value)
							setDropdownOpen(true)
						}}
						onFocus={() => {
							setSearch("")
							setDropdownOpen(true)
						}}
						onBlur={() => {
							setTimeout(() => setDropdownOpen(false), 150)
						}}
						onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
							if (event.key === "Escape") setDropdownOpen(false)
							if (event.key === "Enter" && customValueAvailable) {
								event.preventDefault()
								handleCustomSelect()
							}
						}}
						placeholder={placeholder}
					/>
				</div>
			</PopoverAnchor>
			<PopoverContent
				id={listboxId}
				align="start"
				className="max-h-60 w-(--radix-popover-trigger-width) min-w-48 overflow-y-auto p-1"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (anchorRef.current?.contains(event.target as Node)) event.preventDefault()
				}}
			>
				{filteredOptions.map((option) => (
					<button
						key={option.value}
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => handleSelect(option.value)}
						className={optionClassName}
					>
						{option.isDir ? (
							<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
						) : (
							<FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
						)}
						<span className="truncate">{option.label}</span>
					</button>
				))}
				{customValueAvailable && (
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={handleCustomSelect}
						className={optionClassName}
					>
						<FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="truncate">{getCustomValueLabel(trimmedSearch)}</span>
					</button>
				)}
				{trimmedSearch && filteredOptions.length === 0 && !customValueAvailable && (
					<p className="px-3 py-2 text-center text-[13px] text-muted-foreground">
						No matching folders
					</p>
				)}
			</PopoverContent>
		</Popover>
	)
}
