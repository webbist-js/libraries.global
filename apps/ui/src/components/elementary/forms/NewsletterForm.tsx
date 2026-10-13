"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MoveRight } from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { AppField } from "@/components/forms/AppField"
import { AppForm } from "@/components/forms/AppForm"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"

type Status =
  | { kind: "idle" }
  | { kind: "sent" }
  | { kind: "error"; message: string }

export function NewsletterForm() {
  const tUi = useUiTranslations("ui")

  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const form = useForm<z.infer<FormSchemaType>>({
    resolver: zodResolver(NewsletterFormSchema),
    mode: "onBlur",
    reValidateMode: "onSubmit",
    defaultValues: { email: "", website: "" },
  })

  async function onSubmit(values: z.infer<FormSchemaType>) {
    setStatus({ kind: "idle" })
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (res.ok) {
        setStatus({ kind: "sent" })
        form.reset()

        return
      }
      const json = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      setStatus({
        kind: "error",
        message:
          res.status === 429
            ? "Too many sign-ups from here for now. Please try again later."
            : (json?.error ?? "Sign-up failed. Please try again."),
      })
    } catch {
      setStatus({ kind: "error", message: "Sign-up failed. Please try again." })
    }
  }

  return (
    <div className="flex w-full flex-col">
      <AppForm
        form={form}
        onSubmit={onSubmit}
        id={newsletterForm}
        className="w-full"
      >
        <div className="relative">
          <AppField
            name="email"
            type="email"
            autoComplete="email"
            required
            fieldClassName="h-14 bg-white"
            aria-label="email"
          />
          {/* Honeypot: hidden from people, filled by bots, rejected server-side. */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
          >
            <label htmlFor={`${newsletterForm}-website`}>Website</label>
            <input
              id={`${newsletterForm}-website`}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register("website")}
            />
          </div>
          <Button
            type="submit"
            className="absolute top-1/2 right-3 -translate-y-1/2 md:w-fit"
            form={newsletterForm}
            aria-label={tUi("submit_form")}
            disabled={form.formState.isSubmitting}
          >
            <MoveRight className="size-4" />
          </Button>
        </div>
      </AppForm>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 text-sm"
        style={{
          fontFamily: T.font.sans,
          color: status.kind === "error" ? T.accent.danger : T.accent.ok,
        }}
      >
        {status.kind === "sent" &&
          "Thanks. If confirmation is needed, check your inbox to finish subscribing."}
        {status.kind === "error" && status.message}
      </p>
    </div>
  )
}

const NewsletterFormSchema = z.object({
  email: z.email(),
  website: z.string().max(0).optional(),
})

type FormSchemaType = typeof NewsletterFormSchema

export const newsletterForm = "newsletterForm"
