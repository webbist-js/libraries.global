"use client"

import { ArrowUpRight, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { type FormEvent, useId, useState } from "react"

import { Drawer } from "@/components/ds"
import { primaryCtaSm, secondaryCtaSm } from "@/components/ui/action-styles"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

type Field = "place" | "source" | "sourceUrl" | "licence" | "notes"
const LIMITS: Record<Field, number> = {
  place: 120,
  source: 200,
  sourceUrl: 2048,
  licence: 200,
  notes: 1000,
}
const EMPTY: Record<Field, string> = {
  place: "",
  source: "",
  sourceUrl: "",
  licence: "",
  notes: "",
}

/**
 * Suggest an open dataset in the standard drawer: header, scrolling form
 * and a fixed footer with the actions. It waits for a moderator before it
 * is listed for votes.
 */
export function SuggestDatasetDrawer({
  open,
  onClose,
}: {
  readonly open: boolean
  readonly onClose: () => void
}) {
  const t = useTranslations("roadmap")
  const ui = useTranslations("ui")
  const id = useId()
  const formId = `${id}-form`
  const [values, setValues] = useState(EMPTY)
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState("")
  const sending = state === "sending"

  const close = () => {
    if (sending) return
    onClose()
    if (state === "sent") {
      setValues(EMPTY)
      setState("idle")
    }
    setError("")
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setState("sending")
    setError("")
    const response = await fetch("/api/roadmap/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null)
    if (response?.ok) {
      setState("sent")

      return
    }
    setState("idle")
    setError(
      t(
        response?.status === 429
          ? "suggestTooMany"
          : response?.status === 400
            ? "suggestInvalid"
            : "suggestFailed"
      )
    )
  }

  const field = (name: Field, multiline = false, required = false) => {
    const fieldId = `${id}-${name}`
    const Control = multiline ? Textarea : Input

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={fieldId}
          className="text-sm font-semibold text-(--t-ink-dim)"
        >
          {t(`suggestFields.${name}`)}
          {required ? null : (
            <span className="font-normal"> {t("optional")}</span>
          )}
        </label>
        <Control
          id={fieldId}
          name={name}
          required={required}
          disabled={sending}
          maxLength={LIMITS[name]}
          type={name === "sourceUrl" ? "url" : undefined}
          inputMode={name === "sourceUrl" ? "url" : undefined}
          placeholder={
            name === "sourceUrl" ? "https://" : t(`suggestHints.${name}`)
          }
          value={values[name]}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              [name]: event.target.value,
            }))
          }
          {...(multiline ? { rows: 4 } : {})}
        />
      </div>
    )
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      side="left"
      size="md"
      edgeAligned
      titleId={`${id}-title`}
      title={t("suggestTitle")}
      subtitle={t("suggestSubtitle")}
      icon={{
        name: "mdi:database-plus-outline",
        bg: T.accent.chip,
        fg: T.accent.primary,
      }}
      initialFocus={(panel) =>
        panel.querySelector<HTMLElement>("input:not(:disabled)") ??
        panel.querySelector<HTMLElement>("button")
      }
      footer={
        <div className="shrink-0 border-t border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6">
          {state === "sent" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className={cn(secondaryCtaSm, "min-h-11 cursor-pointer")}
              >
                {t("close")}
              </button>
            </div>
          ) : (
            <>
              <p className="m-0 mb-3 flex max-w-[60ch] items-start gap-2 text-xs leading-relaxed text-(--t-ink-dim)">
                <ShieldCheck size={15} className="shrink-0" aria-hidden />
                {t("suggestReview")}
              </p>
              {error ? (
                <p
                  role="alert"
                  className="m-0 mb-3 text-sm text-(--t-accent-danger)"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={close}
                  className={cn(secondaryCtaSm, "min-h-11 cursor-pointer")}
                >
                  {ui("cancel")}
                </button>
                <button
                  type="submit"
                  form={formId}
                  disabled={sending}
                  aria-busy={sending}
                  className={cn(
                    primaryCtaSm,
                    "min-h-11 w-fit cursor-pointer justify-center disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {t(sending ? "suggestSending" : "suggestSend")}
                  <ArrowUpRight size={16} aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className="min-h-full bg-(--t-bg-deep) px-5 py-6 sm:px-6">
        {state === "sent" ? (
          <p role="status" className="m-0 text-base leading-relaxed">
            {t("suggestThanks")}
          </p>
        ) : (
          <form id={formId} className="flex flex-col gap-5" onSubmit={submit}>
            {field("place", false, true)}
            {field("source", false, true)}
            {field("sourceUrl")}
            {field("licence")}
            {field("notes", true)}
          </form>
        )}
      </div>
    </Drawer>
  )
}
