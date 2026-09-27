"use client"

import type { BaseSyntheticEvent } from "react"
import {
  type FieldValues,
  type SubmitErrorHandler,
  type UseFormReturn,
  FormProvider,
} from "react-hook-form"

import { removeThisWhenYouNeedMe } from "@/lib/general-helpers"

interface Props<T extends FieldValues = FieldValues> {
  readonly form: UseFormReturn<T>
  readonly onSubmit: (
    values: T,

    e?: BaseSyntheticEvent<object, unknown, unknown> | undefined
  ) => void
  readonly onError?: SubmitErrorHandler<T>
  readonly children: React.ReactNode
  readonly className?: string
  readonly id?: string
  readonly disabled?: boolean
  /**
   * Set both on a form with a secret field, so a native submit before
   * hydration is a POST to `action`, not a GET with the values in the URL.
   */
  readonly method?: "get" | "post"
  readonly action?: string
}

export function AppForm<T extends FieldValues = FieldValues>({
  onSubmit,
  onError = () => {
    /* empty */
  },
  children,
  className,
  id,
  form,
  disabled,
  method,
  action,
}: Props<T>) {
  removeThisWhenYouNeedMe("AppForm")

  const { handleSubmit } = form

  return (
    <FormProvider {...form}>
      <form
        method={method}
        action={action}
        onSubmit={handleSubmit(onSubmit, onError)}
        className={className}
        id={id}
        noValidate
      >
        <fieldset disabled={disabled} className="space-y-4">
          {children}
        </fieldset>
      </form>
    </FormProvider>
  )
}
