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
import { captureAnalyticsEvent } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"

type Status =
  | { kind: "idle" }
  | { kind: "sent" }
  | { kind: "error"; message: string }

export function NewsletterForm() {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("newsletterForm")

  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const form = useForm<z.infer<FormSchemaType>>({
    resolver: zodResolver(
      NewsletterFormSchema.extend({ email: z.email(t("invalidEmail")) })
    ),
    mode: "onBlur",
    reValidateMode: "onSubmit",
    defaultValues: { email: "", website: "" },
  })

  async function onSubmit(values: z.infer<FormSchemaType>) {
    const measured = captureAnalyticsEvent("generate_lead", {
      interaction_source: "newsletter",
      submission_type: "newsletter",
    })
    setStatus({ kind: "idle" })
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (res.ok) {
        if (!values.website) measured()
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
            ? t("rateLimited")
            : json?.error ===
                "Use your account email for a newsletter subscription"
              ? t("accountEmail")
              : t("failed"),
      })
    } catch {
      setStatus({ kind: "error", message: t("failed") })
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
            fieldClassName="h-14 bg-(--t-bg-deep)"
            aria-label={tUi("email_address")}
          />
          {/* Honeypot: hidden from people, filled by bots, rejected server-side. */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
          >
            <label htmlFor={`${newsletterForm}-website`}>{t("website")}</label>
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
        {status.kind === "sent" && t("sent")}
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
