"use client"

import type React from "react"
import { useFormContext } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/styles"

import { AppFormDescription } from "./AppFormDescription"
import { AppFormLabel } from "./AppFormLabel"

type Props = {
  readonly name: string
  readonly label?: React.ReactNode
  readonly endAdornment?: React.ReactNode
  readonly containerClassName?: string
  readonly fieldClassName?: string
  readonly description?: React.ReactNode
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">

export function AppField({
  name,
  label,
  endAdornment,
  containerClassName,
  fieldClassName,
  description,
  id,
  ...nativeProps
}: Props) {
  const { control } = useFormContext()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn(containerClassName)}>
          <AppFormLabel
            fieldState={fieldState}
            label={label}
            required={nativeProps.required}
            htmlFor={id}
          />

          <div className="relative flex items-stretch">
            <FormControl>
              <Input
                {...field}
                {...nativeProps}
                {...(id ? { id } : {})}
                value={field.value ?? ""}
                onChange={(event) => {
                  const value = event.target.value
                  if (nativeProps.type === "number") {
                    field.onChange(Number.parseFloat(value))
                  } else {
                    field.onChange(value)
                  }
                }}
                className={cn(
                  "w-full",
                  {
                    "border-(--t-accent-danger)": fieldState.invalid,
                    "rounded-xl border": !endAdornment,
                    "rounded-r-none border-r-0": !!endAdornment,
                  },
                  fieldClassName
                )}
              />
            </FormControl>
            {endAdornment && (
              <div
                className={cn(
                  "flex items-center rounded-r-xl border bg-(--t-bg-muted) px-2 text-(--t-ink-dim)",
                  {
                    "border-y-(--t-accent-danger) border-r-(--t-accent-danger) text-(--t-accent-danger)":
                      fieldState.invalid,
                    "border-input": !fieldState.invalid,
                  }
                )}
              >
                {endAdornment}
              </div>
            )}
          </div>

          <AppFormDescription description={description} />

          <FormMessage />
        </FormItem>
      )}
    />
  )
}
