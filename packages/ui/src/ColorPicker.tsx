import type { CSSProperties, HTMLAttributes } from "react"
import { cn } from "./lib/utils"

export interface ColorPickerOption {
	value: string
	label?: string
}

const PRESET_COLORS: ColorPickerOption[] = [
	{ value: "#ef4444", label: "Red" },
	{ value: "#f97316", label: "Orange" },
	{ value: "#f59e0b", label: "Amber" },
	{ value: "#84cc16", label: "Lime" },
	{ value: "#22c55e", label: "Green" },
	{ value: "#14b8a6", label: "Teal" },
	{ value: "#06b6d4", label: "Cyan" },
	{ value: "#3b82f6", label: "Blue" },
	{ value: "#6366f1", label: "Indigo" },
	{ value: "#8b5cf6", label: "Violet" },
	{ value: "#a855f7", label: "Purple" },
	{ value: "#ec4899", label: "Pink" },
	{ value: "#f43f5e", label: "Rose" },
	{ value: "#78716c", label: "Stone" },
]

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
	value: string | null
	onChange: (color: string | null) => void
	options?: Array<string | ColorPickerOption>
	allowCustom?: boolean
	allowClear?: boolean
	customInputId?: string
	customLabel?: string
	clearLabel?: string
}

type SwatchStyle = CSSProperties & {
	"--color-picker-swatch": string
}

function normalizeOption(option: string | ColorPickerOption): ColorPickerOption {
	return typeof option === "string" ? { value: option } : option
}

function normalizeColor(value: string | null): string | null {
	return value?.toLowerCase() ?? null
}

export function ColorPicker({
	value,
	onChange,
	options = PRESET_COLORS,
	allowCustom = true,
	allowClear = true,
	customInputId,
	customLabel = "Custom color",
	clearLabel = "Clear color",
	className = "",
	...rest
}: Props) {
	const normalizedValue = normalizeColor(value)
	const colorOptions = options.map(normalizeOption)
	const fallbackColor = value ?? colorOptions[0]?.value ?? "#3b82f6"

	return (
		<div className={cn("color-picker flex min-w-0 flex-col gap-2", className)} {...rest}>
			{colorOptions.length > 0 && (
				<div className="color-picker-swatches flex flex-wrap gap-1.5">
					{colorOptions.map((option) => {
						const active = normalizeColor(option.value) === normalizedValue
						const label = option.label ? `${option.label} (${option.value})` : option.value
						return (
							<button
								key={`${option.value}-${option.label ?? ""}`}
								type="button"
								className="color-picker-swatch size-5 rounded-[5px] border border-border/70 outline-none ring-offset-background transition-[border-color,box-shadow,transform] active:scale-95 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring/40"
								style={{ "--color-picker-swatch": option.value } as SwatchStyle}
								data-active={active ? "true" : undefined}
								onClick={() => onChange(active && allowClear ? null : option.value)}
								aria-label={label}
								aria-pressed={active}
								title={label}
							/>
						)
					})}
				</div>
			)}
			{allowCustom && (
				<div className="color-picker-custom flex min-w-0 items-center gap-2">
					<input
						id={customInputId}
						type="color"
						value={fallbackColor}
						onChange={(event) => onChange(event.target.value)}
						className="color-picker-input size-7 rounded-[6px] border border-input bg-transparent p-0"
						aria-label={customLabel}
					/>
					<span className="color-picker-hex min-w-[64px] font-mono text-[11px] text-muted-foreground">
						{value ?? "None"}
					</span>
					{allowClear && value && (
						<button
							type="button"
							className="color-picker-clear text-xs text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => onChange(null)}
						>
							{clearLabel}
						</button>
					)}
				</div>
			)}
		</div>
	)
}
