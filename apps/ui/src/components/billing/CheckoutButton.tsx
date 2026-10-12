"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

const CheckoutFlow = dynamic(
  () => import("./CheckoutFlow").then((m) => m.CheckoutFlow),
  { ssr: false }
)

export function CheckoutButton({
  plan,
  interval,
  user,
}: {
  readonly plan: "supporter" | "pro"
  readonly interval: "month" | "year"
  readonly user: {
    email: string
    verified: boolean
    complimentaryPro: boolean
  } | null
}) {
  const t = useTranslations("billing")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="min-h-11 w-full rounded-full bg-(--t-accent-primary) px-5 py-3 font-semibold text-white"
        >
          {t("join", { plan: t(plan) })}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto overscroll-contain rounded-3xl bg-white p-0 sm:max-w-[calc(100%-3rem)] lg:max-w-6xl"
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-white opacity-100 hover:bg-(--t-bg-surface) data-[state=open]:bg-white"
      >
        <DialogTitle className="sr-only">{t("secureCheckout")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("providerExplanation")}
        </DialogDescription>
        {open ? (
          <CheckoutFlow
            user={user}
            initialPlan={plan}
            initialInterval={interval}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
