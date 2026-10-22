"use client"

import {
  ArrowRight,
  Check,
  Code2,
  CreditCard,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { useContactModal } from "@/components/contact/ContactModalProvider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Link } from "@/lib/navigation"

export default function BetaWelcome({
  sandbox,
  onClose,
}: {
  readonly sandbox: boolean
  readonly onClose: () => void
}) {
  const t = useTranslations("betaWelcome")
  const { openFeedback } = useContactModal()
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[28px] border-(--t-border-line) bg-(--t-bg-deep) p-0 text-(--t-ink-base) sm:max-w-[880px]"
        closeButtonClassName="top-5 right-5"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          title.current?.focus()
        }}
      >
        <div className="border-b border-(--t-border-line) bg-(--t-bg-selected) px-6 pt-6 pb-5 sm:px-8">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-(--t-bg-deep) px-3 py-1.5 text-xs font-semibold text-(--t-accent-primary)">
            <Sparkles size={15} aria-hidden />
            Libraries Global · {t("badge")}
          </span>
          <DialogTitle
            ref={title}
            tabIndex={-1}
            style={{ outline: "none" }}
            className="pr-5 font-serif text-[clamp(32px,5vw,42px)] leading-[1.05] font-medium tracking-tight outline-none"
          >
            {t("title")}
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
            {t("intro")}
          </DialogDescription>
        </div>
        <div className="grid gap-6 px-6 py-5 sm:px-8 md:grid-cols-[1.1fr_1fr]">
          <section aria-labelledby="beta-try-title">
            <h3
              id="beta-try-title"
              className="m-0 mb-4 text-base font-semibold"
            >
              {t("tryTitle")}
            </h3>
            <ul className="m-0 grid list-none gap-3 p-0">
              {(["explore", "contribute", "team", "api"] as const).map(
                (key) => (
                  <li key={key} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--t-bg-selected) text-(--t-accent-primary)">
                      <Check size={14} aria-hidden />
                    </span>
                    <span className="text-sm leading-relaxed">
                      <strong className="block font-semibold">
                        {t(`${key}Title`)}
                      </strong>
                      <span className="text-(--t-ink-dim)">
                        {t(`${key}Body`)}
                      </span>
                    </span>
                  </li>
                )
              )}
            </ul>
          </section>
          <section
            aria-labelledby="beta-payments-title"
            className="rounded-[20px] border border-(--t-border-line) bg-(--t-bg-surface) p-5"
          >
            <h3
              id="beta-payments-title"
              className="m-0 flex items-center gap-2 text-base font-semibold"
            >
              <CreditCard size={18} aria-hidden />
              {t("paymentTitle")}
            </h3>
            {sandbox ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-(--t-ink-dim)">
                  {t("paymentBody")}
                </p>
                <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-4">
                  <p className="m-0 text-xs font-semibold text-(--t-ink-dim)">
                    {t("cardLabel")}
                  </p>
                  <code
                    translate="no"
                    className="mt-2 block font-mono text-[clamp(15px,3.6vw,20px)] font-semibold tracking-wide"
                  >
                    4242 4242 4242 4242
                  </code>
                  <p className="mt-3 mb-0 text-xs leading-relaxed text-(--t-ink-dim)">
                    {t("cardDetails")}
                  </p>
                  <Button
                    type="button"
                    variant="surface"
                    size="pill"
                    className="mt-3 min-h-11"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText("4242424242424242")
                        setCopied(true)
                        setCopyFailed(false)
                      } catch {
                        setCopyFailed(true)
                      }
                    }}
                  >
                    {copied ? t("copied") : t("copyCard")}
                  </Button>
                  <span
                    role="status"
                    className="block text-xs text-(--t-ink-dim)"
                  >
                    {copyFailed ? t("copyFailed") : copied ? t("copied") : ""}
                  </span>
                </div>
                <p className="mt-3 mb-0 text-xs leading-relaxed text-(--t-ink-dim)">
                  {t("testOnly")}{" "}
                  <a
                    href="https://docs.stripe.com/testing"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {t("stripeGuide")}
                  </a>
                </p>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-(--t-ink-dim)">
                {t("paymentsOff")}
              </p>
            )}
          </section>
        </div>
        <div className="mx-6 mb-5 flex gap-3 rounded-2xl bg-(--t-bg-surface) p-4 sm:mx-8">
          <RotateCcw
            size={19}
            aria-hidden
            className="mt-0.5 shrink-0 text-(--t-accent-primary)"
          />
          <p className="m-0 text-sm leading-relaxed">
            <strong className="block">{t("resetTitle")}</strong>
            <span className="text-(--t-ink-dim)">{t("resetBody")}</span>
          </p>
        </div>
        <div className="border-t border-(--t-border-line) px-6 py-4 sm:px-8">
          <p className="mt-0 mb-4 text-sm leading-relaxed text-(--t-ink-dim)">
            {t("feedbackBody")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="pill"
              onClick={onClose}
            >
              {t("start")}
              <ArrowRight size={16} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="surface"
              size="pill"
              onClick={() => {
                onClose()
                openFeedback()
              }}
            >
              <MessageSquare size={16} aria-hidden />
              {t("feedback")}
            </Button>
            <Link
              href="/knowledge/data-api/team-api-quickstart"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              <Code2 size={16} aria-hidden />
              {t("apiGuide")}
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
