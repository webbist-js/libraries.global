"use client"

import { useId } from "react"

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
  value,
  onValueChange,
  options,
  label,
  id,
  name,
  required,
  disabled,
  className,
}: {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly options: readonly {
    value: string
    label: string
    disabled?: boolean
  }[]
  readonly label: string
  readonly id?: string
  readonly name?: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly className?: string
}) {
  const generatedId = useId()

  return (
    <Select
      value={value ? optionValue(value) : ""}
      onValueChange={(next) =>
        onValueChange(next === EMPTY_VALUE ? "" : next.slice("option:".length))
      }
      required={required}
      disabled={disabled}
    >
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <SelectTrigger
        id={id ?? generatedId}
        aria-label={label}
        className={cn(
          "min-h-11 w-full rounded-xl border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base)",
          className
        )}
      >
        <SelectValue
          placeholder={
            options.find((option) => option.value === "")?.label ?? label
          }
        />
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="rounded-xl border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base)"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={optionValue(option.value)}
            disabled={option.disabled}
            className="min-h-10 cursor-pointer focus:bg-(--t-bg-surface) focus:text-(--t-ink-base)"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
