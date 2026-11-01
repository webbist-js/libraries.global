"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type AriaAttributes,
  type CSSProperties,
  type ReactNode,
} from "react"

import {
  DROPDOWN_OPTION,
  DROPDOWN_PANEL,
  DROPDOWN_SELECT_POSITION,
} from "@/components/ds/dropdown-styles"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/styles"

const EMPTY_VALUE = "empty"
const optionValue = (value: string) => (value ? `option:${value}` : EMPTY_VALUE)

/** The shared site Select, with labelled options and support for an empty choice. */
export function SelectField({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  options,
  label,
  id,
  name,
  required,
  disabled,
  className,
  appearance = "field",
  leading,
  style,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-required": ariaRequired,
}: {
  readonly value?: string
  readonly defaultValue?: string
  readonly onValueChange?: (value: string) => void
  readonly options: readonly {
    value: string
    label: string
    disabled?: boolean
  }[]
  readonly label?: string
  readonly id?: string
  readonly name?: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly className?: string
  readonly appearance?: "field" | "pill"
  readonly leading?: ReactNode
  readonly style?: CSSProperties
  readonly "aria-describedby"?: string
  readonly "aria-invalid"?: AriaAttributes["aria-invalid"]
  readonly "aria-required"?: AriaAttributes["aria-required"]
}) {
  const generatedId = useId()
  const pill = appearance === "pill"
  const [localValue, setLocalValue] = useState(defaultValue)
  const value = controlledValue ?? localValue
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const form = trigger.current?.form
    if (!form || controlledValue !== undefined) return
    const reset = () => setLocalValue(defaultValue)
    form.addEventListener("reset", reset)

    return () => form.removeEventListener("reset", reset)
  }, [controlledValue, defaultValue])

  return (
    <Select
      value={value ? optionValue(value) : ""}
      onValueChange={(next) => {
        const selected =
          next === EMPTY_VALUE ? "" : next.slice("option:".length)
        if (controlledValue === undefined) setLocalValue(selected)
        onValueChange?.(selected)
      }}
      required={required}
      disabled={disabled}
    >
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <SelectTrigger
        ref={trigger}
        id={id ?? generatedId}
        style={style}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-required={ariaRequired ?? required}
        aria-label={label}
        className={cn(
          "min-h-11 w-full rounded-xl border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base)",
          pill &&
            "min-h-[44px] w-auto min-w-[180px] gap-2.5 rounded-full px-4 text-base font-semibold shadow-none transition-colors hover:border-(--t-border-hi) hover:bg-(--t-bg-surface) data-[size=default]:h-[44px] [&_svg]:opacity-100",
          className
        )}
      >
        {leading ? (
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center text-(--t-ink-dim)"
          >
            {leading}
          </span>
        ) : null}
        <SelectValue
          className={leading ? "flex-1 text-left" : undefined}
          placeholder={
            options.find((option) => option.value === "")?.label ?? label
          }
        >
          {pill
            ? options.find((option) => option.value === value)?.label
            : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align={pill ? "end" : "center"}
        sideOffset={pill ? 8 : undefined}
        collisionPadding={pill ? 16 : undefined}
        className={cn(
          "rounded-xl border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base)",
          pill && [DROPDOWN_PANEL, DROPDOWN_SELECT_POSITION, "w-[240px] p-1"],
          "z-[100]"
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={optionValue(option.value)}
            disabled={option.disabled}
            className={
              pill
                ? DROPDOWN_OPTION
                : "min-h-10 cursor-pointer focus:bg-(--t-bg-surface) focus:text-(--t-ink-base)"
            }
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
