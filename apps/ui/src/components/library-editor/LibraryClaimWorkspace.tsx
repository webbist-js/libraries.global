"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { FindLibraryFirst } from "@/components/library-editor/FindLibraryFirst"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import type { ClaimLibrary } from "@/lib/library-claim"
import { Link } from "@/lib/navigation"

import { LibraryClaimForm } from "./LibraryClaimForm"

export function LibraryClaimWorkspace({
  initialLibrary,
  context = "contribute",
  guide,
}: {
  readonly initialLibrary?: ClaimLibrary
  readonly context?: "staff" | "contribute"
  readonly guide?: { href: string; title: string } | null
}) {
  const t = useTranslations("libraryClaim")
  const [library, setLibrary] = useState(initialLibrary)
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus())

  return (
    <main className="grid w-full min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="grid min-w-0 gap-5 sm:gap-6">
        <StaffPanel>
          {submitted ? (
            <div role="status" className="space-y-5 py-3">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
                <Icon icon="mdi:check" width={24} aria-hidden />
              </span>
              <h2
                ref={heading}
                tabIndex={-1}
                className="m-0 font-serif text-[32px] leading-tight outline-none"
              >
                {t("sent")}
              </h2>
              <p className="max-w-[60ch] text-[16px] leading-relaxed text-(--t-ink-dim)">
                {t("sentBody", { library: library?.libraryName ?? "" })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary" size="pill">
                  <Link href="/contribute/submissions">{t("track")}</Link>
                </Button>
                <Button asChild variant="surface" size="pill">
                  <Link
                    href={context === "staff" ? "/staff" : "/contribute/index"}
                  >
                    {context === "staff" ? t("backStaff") : t("backIndex")}
                  </Link>
                </Button>
              </div>
            </div>
          ) : library ? (
            <>
              <div className="mb-6 flex flex-col items-start gap-4 border-b border-(--t-border-line) pb-6 sm:flex-row sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[14px] font-semibold text-(--t-accent-primary)">
                    {t("selected")}
                  </p>
                  <h2
                    ref={heading}
                    tabIndex={-1}
                    className="m-0 font-serif text-[clamp(26px,3vw,34px)] leading-tight break-words outline-none"
                  >
                    {library.libraryName}
                  </h2>
                </div>
                <Button
                  variant="surface"
                  size="pill"
                  className="shrink-0"
                  disabled={pending}
                  onClick={() => {
                    setLibrary(undefined)
                    focusHeading()
                  }}
                >
                  {t("change")}
                </Button>
              </div>
              <LibraryClaimForm
                key={library.libraryDocumentId}
                library={library}
                onPendingChange={setPending}
                onSuccess={() => {
                  setPending(false)
                  setSubmitted(true)
                  focusHeading()
                }}
              />
            </>
          ) : (
            <div>
              <FindLibraryFirst
                headingRef={heading}
                needsHelp={[]}
                intent="claim"
                onChooseLibrary={(hit) => {
                  setLibrary({
                    libraryDocumentId: hit.documentId,
                    librarySlug: hit.slug,
                    libraryName: hit.name,
                    libraryEntityRef: hit.entityRef ?? undefined,
                  })
                  focusHeading()
                }}
              />
            </div>
          )}
        </StaffPanel>
        <StaffPanel title="Manage a wider service?">
          <p>
            Request employment verification or management of a reviewed group of
            libraries in one service claim.
          </p>
          <Link
            className="font-semibold underline underline-offset-4"
            href="/staff/networks"
          >
            Find your service or network
          </Link>
        </StaffPanel>
        <Notice icon="mdi:shield-check-outline" tone="info" title={t("after")}>
          <p className="m-0 max-w-[80ch]">{t("afterBody")}</p>
        </Notice>
      </div>
      <aside
        className="min-w-0 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
        aria-label={t("next")}
      >
        <StaffPanel
          title={t("next")}
          compact
          footer={
            guide ? (
              <Button asChild variant="surface" size="pill" className="w-full">
                <Link href={guide.href}>
                  {t("guide")}
                  <Icon icon="mdi:arrow-right" width={18} aria-hidden />
                </Link>
              </Button>
            ) : undefined
          }
        >
          <ol className="m-0 grid list-none gap-6 p-0">
            {(["find", "details", "review"] as const).map((step, i) => (
              <li key={step} className="flex gap-3 text-[15px] leading-relaxed">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) font-semibold text-(--t-accent-primary)"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <strong className="block">{t(step)}</strong>
                  <p className="m-0 mt-1 text-(--t-ink-dim)">
                    {t(`${step}Body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </StaffPanel>
      </aside>
    </main>
  )
}
