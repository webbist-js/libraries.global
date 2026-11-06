"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { pushCheckoutEvent } from "@/lib/checkout-analytics"
import type { ApiDashboard } from "@/lib/team-api/types"

import { ApiCheckoutReview } from "./ApiCheckoutReview"

/** A fresh, explicit consent step each time an organiser opens checkout. */
export function TeamApiSubscribeDialog({
  data,
  locale,
  pending,
  error,
  clearError,
  request,
  initialOpen = false,
}: {
  readonly initialOpen?: boolean
  readonly data: ApiDashboard
  readonly locale: string
  readonly pending: boolean
  readonly error: string
  readonly clearError: () => void
  readonly request: (body: unknown) => void
}) {
  const t = useTranslations("teamApiSubscription")
  const [open, setOpen] = useState(initialOpen)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const began = useRef(false)
  useEffect(() => {
    if (!open) {
      began.current = false

      return
    }
    if (began.current) return
    began.current = true
    pushCheckoutEvent("begin_checkout", {
      product: "team_api",
      billing_interval: "month",
    })
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return
        setOpen(next)
        clearError()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="primary" size="pill" disabled={pending}>
          {t(data.purchasing && data.price ? "addAccess" : "viewAddon")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto overscroll-contain rounded-3xl border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) motion-reduce:animate-none sm:max-w-2xl sm:p-8"
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) opacity-100 hover:bg-(--t-bg-surface)"
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
        aria-busy={pending}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
      >
        <DialogHeader className="gap-3 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="type-h2 m-0 pr-12 outline-none"
          >
            {t("title")}
          </DialogTitle>
          <DialogDescription className="m-0 text-base leading-relaxed [overflow-wrap:anywhere] text-(--t-ink-dim)">
            {t("description", { team: data.teamName })}
          </DialogDescription>
        </DialogHeader>
        <ApiCheckoutReview
          price={data.price}
          purchasing={data.purchasing}
          overageAvailable={data.overageAvailable}
          limits={data.limits}
          rates={data.rates}
          locale={locale}
          pending={pending}
          error={error}
          owner={data.teamName}
          onCancel={() => {
            setOpen(false)
            clearError()
          }}
          onSubscribe={(termsVersion) =>
            request({ action: "checkout", locale, termsVersion })
          }
        />
      </DialogContent>
    </Dialog>
  )
}
