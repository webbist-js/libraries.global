"use client"

import { Icon } from "@iconify/react"
import {
  API_REACH_PER_HOUR,
  API_REACH_SERVICE_LIBRARIES,
  CONTRIBUTOR_REACH_PER_WEEK,
} from "@repo/access"
import { useTranslations } from "next-intl"
import { useId, useRef } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const primaryAction = buttonVariants({
  variant: "primary",
  size: "pill",
  className: "w-full sm:w-auto sm:self-start",
})
const secondaryAction = buttonVariants({
  variant: "surface",
  size: "pill",
  className: "w-full border-(--t-border-hi) sm:w-auto sm:self-start",
})
const inlineLink =
  "font-semibold text-(--t-accent-primary) underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"

/**
 * Why Reach is locked and the two ways to unlock it: contribute (free) or
 * API Access. `service` is Reach for a whole library service, which only
 * API Access includes. Focus returns to whatever opened it.
 */
export function AtlasReachLockDialog({
  open,
  onOpenChange,
  scope = "library",
  signedIn,
  onSignIn,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly scope?: "library" | "service"
  readonly signedIn: boolean
  readonly onSignIn?: () => void
}) {
  const t = useTranslations("accessLocks")
  const titleRef = useRef<HTMLHeadingElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const contributorId = useId()
  const apiId = useId()
  const service = scope === "service"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto overscroll-contain rounded-3xl border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) motion-reduce:animate-none sm:p-8"
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) opacity-100"
        onOpenAutoFocus={(event) => {
          // Radix only restores focus to its own Trigger; remember ours.
          returnTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
          event.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnTo.current?.focus()
          returnTo.current = null
        }}
      >
        <DialogHeader className="gap-3 text-left">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: T.accent.chip, color: T.accent.primary }}
          >
            <Icon height={24} icon="mdi:map-marker-radius-outline" width={24} />
          </span>
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="type-h2 m-0 pr-12 outline-none"
          >
            {t(service ? "serviceReachDialogTitle" : "reachDialogTitle")}
          </DialogTitle>
          <DialogDescription className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
            {t(service ? "serviceReachDialogLead" : "reachDialogLead")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {service ? null : (
            <section
              aria-labelledby={contributorId}
              className="flex flex-col gap-3 rounded-2xl p-4 sm:p-5"
              style={{ background: T.accent.chip }}
            >
              <h3 id={contributorId} className="type-small-heading m-0">
                {t("reachPathContributor")}
              </h3>
              <p className="m-0 text-sm leading-relaxed">
                {t("reachPathContributorBody", {
                  count: CONTRIBUTOR_REACH_PER_WEEK,
                })}
              </p>
              {signedIn ? null : (
                <p className="m-0 flex items-start gap-2 text-sm leading-relaxed">
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    height={18}
                    icon="mdi:account-outline"
                    style={{ color: T.accent.primary }}
                    width={18}
                  />
                  <span>
                    {t.rich("reachSignInHint", {
                      signIn: (chunks) =>
                        onSignIn ? (
                          <button
                            type="button"
                            onClick={onSignIn}
                            className={inlineLink}
                          >
                            {chunks}
                          </button>
                        ) : (
                          <GlobalLink
                            href="/auth/signin"
                            className={inlineLink}
                          >
                            {chunks}
                          </GlobalLink>
                        ),
                      register: (chunks) => (
                        <GlobalLink
                          href="/auth/register"
                          className={inlineLink}
                        >
                          {chunks}
                        </GlobalLink>
                      ),
                    })}
                  </span>
                </p>
              )}
              <Link href="/contribute" className={primaryAction}>
                {t("reachCta")}
                <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
              </Link>
            </section>
          )}
          <section
            aria-labelledby={apiId}
            className="flex flex-col gap-3 rounded-2xl border p-4 sm:p-5"
            style={{ borderColor: T.border.line }}
          >
            <h3 id={apiId} className="type-small-heading m-0">
              {t("reachPathApi")}
            </h3>
            <p className="m-0 text-sm leading-relaxed">
              {t("reachPathApiBody", {
                perHour: API_REACH_PER_HOUR,
                libraries: API_REACH_SERVICE_LIBRARIES,
              })}
            </p>
            <Link
              href="/developers"
              className={service ? primaryAction : secondaryAction}
            >
              {t("reachApiCta")}
            </Link>
          </section>
        </div>

        <DialogClose asChild>
          <button
            type="button"
            className="min-h-11 self-center rounded-full px-4 text-sm font-semibold text-(--t-ink-dim) underline-offset-4 hover:text-(--t-ink-base) hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
          >
            {t("notNow")}
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
