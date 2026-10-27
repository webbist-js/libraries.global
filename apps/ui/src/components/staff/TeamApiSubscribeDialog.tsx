"use client"

import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link } from "@/lib/navigation"
import { API_TERMS_VERSION } from "@/lib/team-api/constants"
import type { ApiDashboard } from "@/lib/team-api/types"

/** A fresh, explicit consent step each time an organiser opens checkout. */
export function TeamApiSubscribeDialog({
  data,
  locale,
  pending,
  error,
  clearError,
  request,
}: {
  readonly data: ApiDashboard
  readonly locale: string
  readonly pending: boolean
  readonly error: string
  readonly clearError: () => void
  readonly request: (body: unknown) => void
}) {
  const t = useTranslations("teamApiSubscription")
  const [open, setOpen] = useState(false)
  const [consent, setConsent] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const count = (value: number) => new Intl.NumberFormat(locale).format(value)
  const price = data.price
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: data.price.currency,
      }).format(data.price.unitAmount / 100)
    : null
  const bytes = count(data.limits.bytes / 1024 ** 3) + " GiB"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return
        setOpen(next)
        setConsent(false)
        clearError()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="primary" size="pill" disabled={pending}>
          {t(data.purchasing && price ? "addAccess" : "viewAddon")}
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

        <div className="space-y-5">
          <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5">
            {price ? (
              <>
                <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-sans text-[38px] leading-tight tabular-nums">
                    {price}
                  </span>
                  <span className="text-base text-(--t-ink-dim)">
                    {t("perMonth")}
                  </span>
                </p>
                <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {t("taxDetail")}
                </p>
              </>
            ) : null}
            {!data.purchasing || !price ? (
              <p
                role="status"
                className="m-0 text-base leading-relaxed text-(--t-ink-dim)"
              >
                {t("unavailable")}
              </p>
            ) : null}
          </div>
          <div>
            <h3 className="type-small-heading mt-0 mb-3">{t("allowance")}</h3>
            <dl className="m-0 grid grid-cols-2 gap-3">
              {[
                { label: t("requests"), value: count(data.limits.requests) },
                { label: t("responseData"), value: bytes },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="min-w-0 rounded-2xl border border-(--t-border-line) p-4"
                >
                  <dt className="text-sm font-semibold text-(--t-ink-dim)">
                    {metric.label}
                  </dt>
                  <dd className="type-h2 mt-2 mb-0 ml-0 [overflow-wrap:anywhere] tabular-nums">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 mb-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm leading-relaxed text-(--t-ink-dim)">
              <li>{t("rate", { count: count(data.limits.perMinute) })}</li>
              <li>
                {t("concurrency", { count: count(data.limits.concurrency) })}
              </li>
              <li>{t("keys")}</li>
            </ul>
            <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("noOverage")}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-base leading-relaxed">
            <input
              type="checkbox"
              checked={consent}
              disabled={pending}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
            />
            <span>
              {t.rich("consent", {
                membership: (chunks) => (
                  <Link href="/legal/membership" className={STAFF_LINK}>
                    {chunks}
                  </Link>
                ),
                refunds: (chunks) => (
                  <Link
                    href="/legal/cancellation-refunds"
                    className={STAFF_LINK}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {error ? (
            <p
              role="alert"
              className="m-0 rounded-2xl border border-(--t-accent-danger)/30 bg-(--t-bg-surface) p-4 text-base leading-relaxed text-(--t-accent-danger)"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-3 border-t border-(--t-border-line) pt-5">
          <DialogClose asChild>
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={pending}
            >
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="primary"
            size="pill"
            disabled={pending || !consent || !data.purchasing || !price}
            aria-busy={pending}
            onClick={() =>
              request({
                action: "checkout",
                locale,
                termsVersion: API_TERMS_VERSION,
              })
            }
          >
            {t(pending ? "opening" : "subscribe")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
