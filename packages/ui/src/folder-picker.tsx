"use client"

import { FileIcon, FolderIcon } from "lucide-react"
import { useCallback, useId, useMemo, useRef, useState } from "react"
import { Input } from "./input"
import { nativeGlassSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"

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
	reserveDropdownSpace?: boolean
}

export function FolderPicker({
	options,
	value,
	onChange,
	placeholder = "Search folders...",
	className,
	allowCustomValue = false,
	getCustomValueLabel = (customValue) => `Add "${customValue}"`,
	reserveDropdownSpace = false,
}: FolderPickerProps) {
	const [search, setSearch] = useState("")
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const listboxId = useId()

	const filteredOptions = useMemo(() => {
		if (!search.trim()) return options
		const lower = search.toLowerCase()
		return options.filter((option) => option.label.toLowerCase().includes(lower))
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

	return (
		<div
			className={cn(
				"relative transition-[padding] duration-150",
				dropdownVisible && reserveDropdownSpace && "pb-64",
				className,
			)}
		>
			<Input
				ref={inputRef}
				role="combobox"
				aria-controls={listboxId}
				aria-expanded={dropdownOpen}
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
					if (event.key === "Enter" && customValueAvailable) {
						event.preventDefault()
						handleCustomSelect()
					}
				}}
				placeholder={placeholder}
			/>
			{dropdownOpen && (filteredOptions.length > 0 || customValueAvailable) && (
				<div
					id={listboxId}
					className={cn(
						"absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-[10px] p-1",
						nativeGlassSurface,
					)}
				>
					{filteredOptions.map((option) => (
						<button
							key={option.value}
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => handleSelect(option.value)}
							className="flex items-center gap-2 w-full rounded-[6px] px-2 py-1.5 text-[13px] text-left hover:bg-accent/70"
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
							className="flex items-center gap-2 w-full rounded-[6px] px-2 py-1.5 text-[13px] text-left hover:bg-accent/70"
						>
							<FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
							<span className="truncate">{getCustomValueLabel(trimmedSearch)}</span>
						</button>
					)}
				</div>
			)}
			{dropdownOpen && trimmedSearch && filteredOptions.length === 0 && !customValueAvailable && (
				<div className={cn("absolute z-50 mt-1 w-full rounded-[10px] p-1", nativeGlassSurface)}>
					<p className="px-3 py-2 text-[13px] text-muted-foreground text-center">
						No matching folders
					</p>
				</div>
			)}
		</div>
	)
}
