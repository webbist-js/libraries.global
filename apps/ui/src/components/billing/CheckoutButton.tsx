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
      <DialogContent className="max-h-dvh max-w-full gap-0 overflow-auto rounded-none bg-white p-0 sm:max-w-5xl sm:rounded-3xl [&_[data-slot=dialog-close]]:grid [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:place-items-center">
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
