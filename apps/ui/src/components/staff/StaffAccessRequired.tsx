"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { PageHero } from "@/components/ds"
import { SectionTabs } from "@/components/ds/SectionTabs"
import { Container } from "@/components/elementary/Container"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/lib/navigation"

export type ClaimableStaffLibrary = {
  documentId: string
  name: string
  slug: string
  entityRef?: string | null
  path?: string | null
}

/** This introduction receives public identity only, never private staff data. */
export function StaffAccessRequired({
  library,
  signedIn = false,
  returnTo = "/staff",
}: {
  readonly library?: ClaimableStaffLibrary
  readonly signedIn?: boolean
  readonly returnTo?: string
}) {
  const t = useTranslations("staffOnboarding")
  const query = library
    ? new URLSearchParams({
        librarySlug: library.slug,
        libraryName: library.name,
        libraryDocumentId: library.documentId,
        ...(library.entityRef ? { libraryEntityRef: library.entityRef } : {}),
      })
    : null
  const claimHref = "/staff/claim" + (query ? "?" + query : "")
  const startHref = signedIn
    ? claimHref
    : "/auth/signin?callbackUrl=" + encodeURIComponent(claimHref)
  const benefits = [
    { id: "record", icon: "mdi:library-outline" },
    { id: "notices", icon: "mdi:bullhorn-outline" },
    { id: "events", icon: "mdi:calendar-outline" },
  ] as const
  const steps = ["find", "proof", "review"] as const
  const questions = ["eligibility", "missing", "pending", "team"] as const

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        eyebrowIcon="mdi:shield-account-outline"
        title={library ? t("libraryTitle") : t("title")}
        lead={library ? t("libraryLead", { name: library.name }) : t("lead")}
        tabs={
          <SectionTabs
            label={t("navigation")}
            activeId={null}
            tabs={[
              {
                id: "benefits",
                label: t("benefitsNav"),
                href: "#staff-benefits",
                icon: "mdi:library-outline",
              },
              {
                id: "steps",
                label: t("stepsNav"),
                href: "#staff-steps",
                icon: "mdi:shield-check-outline",
              },
              {
                id: "questions",
                label: t("questionsNav"),
                href: "#staff-questions",
                icon: "mdi:help-circle-outline",
              },
            ]}
          />
        }
      />
      <Container className="space-y-10 py-8 sm:space-y-14 sm:py-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <StaffPanel
            id="claim-staff-access"
            title={library ? t("claimThis") : t("claimYour")}
          >
            <p className="m-0 max-w-[60ch] text-[17px] leading-relaxed text-(--t-ink-dim)">
              {t("claimIntro")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={startHref}
                className={buttonVariants({ variant: "primary", size: "pill" })}
              >
                {library ? t("claimThis") : t("claimYour")}
                <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
              </Link>
              <Link
                href={library?.path ?? "/libraries"}
                className={buttonVariants({ variant: "surface", size: "pill" })}
              >
                {library ? t("publicPage") : t("browse")}
              </Link>
            </div>
            <p className="mt-6 mb-0 border-t border-(--t-border-line) pt-5 text-[15px] leading-relaxed text-(--t-ink-dim)">
              {signedIn ? (
                <>
                  {t("pendingHint")}{" "}
                  <Link href="/contribute/submissions" className={STAFF_LINK}>
                    {t("submissions")}
                  </Link>
                </>
              ) : (
                <>
                  {t("alreadyVerified")}{" "}
                  <Link
                    href={
                      "/auth/signin?callbackUrl=" + encodeURIComponent(returnTo)
                    }
                    className={STAFF_LINK}
                  >
                    {t("signIn")}
                  </Link>
                  .
                </>
              )}
            </p>
          </StaffPanel>
          <aside className="rounded-3xl bg-(--t-bg-space) p-6 sm:p-7">
            <Icon
              aria-hidden="true"
              icon="mdi:shield-check-outline"
              width={28}
              className="text-(--t-accent-primary)"
            />
            <h2 className="mt-4 mb-3 font-serif text-[26px] leading-tight text-(--t-ink-base)">
              {t("trustTitle")}
            </h2>
            <p className="m-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
              {t("trustCopy")}
            </p>
            <p className="mt-4 mb-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
              {t("publicCopy")}
            </p>
          </aside>
        </div>

        <section
          id="staff-benefits"
          aria-labelledby="staff-benefits-title"
          className="scroll-mt-(--sticky-content-top)"
        >
          <div className="mb-5 max-w-[65ch]">
            <h2
              id="staff-benefits-title"
              className="m-0 font-serif text-[clamp(28px,3vw,38px)] leading-tight text-(--t-ink-base)"
            >
              {t("benefitsTitle")}
            </h2>
            <p className="mt-3 mb-0 text-[16px] leading-relaxed text-(--t-ink-dim)">
              {t("benefitsIntro")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map(({ id, icon }) => (
              <StaffPanel key={id} compact>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-(--t-accent-primary)/10 text-(--t-accent-primary)">
                  <Icon aria-hidden="true" icon={icon} width={23} />
                </span>
                <h3 className="mt-5 mb-2 font-serif text-[24px] leading-tight text-(--t-ink-base)">
                  {t(`${id}Title`)}
                </h3>
                <p className="m-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
                  {t(`${id}Copy`)}
                </p>
              </StaffPanel>
            ))}
          </div>
        </section>

        <StaffPanel
          id="staff-steps"
          title={t("stepsTitle")}
          className="scroll-mt-(--sticky-content-top)"
        >
          <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3 md:gap-8">
            {steps.map((id, i) => (
              <li key={id} className="min-w-0">
                <span
                  aria-hidden="true"
                  className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-(--t-accent-primary)/10 text-[14px] font-semibold text-(--t-accent-primary)"
                >
                  {i + 1}
                </span>
                <h3 className="m-0 text-[17px] font-semibold text-(--t-ink-base)">
                  {t(`${id}Title`)}
                </h3>
                <p className="mt-2 mb-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
                  {t(`${id}Copy`)}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-(--t-border-line) pt-6">
            <p className="m-0 max-w-[60ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
              {t("evidenceNote")}
            </p>
            <Link
              href={startHref}
              className={buttonVariants({ variant: "primary", size: "pill" })}
            >
              {t("startClaim")}
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
            </Link>
          </div>
        </StaffPanel>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <StaffPanel
            id="staff-questions"
            title={t("questionsTitle")}
            className="scroll-mt-(--sticky-content-top)"
          >
            <div className="divide-y divide-(--t-border-line)">
              {questions.map((id) => (
                <details key={id} className="group py-4 first:pt-0 last:pb-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-(--t-ink-base) [&::-webkit-details-marker]:hidden">
                    {t(`${id}Question`)}
                    <Icon
                      aria-hidden="true"
                      icon="mdi:plus"
                      width={20}
                      className="shrink-0 text-(--t-ink-dim) group-open:rotate-45"
                    />
                  </summary>
                  <p className="mt-2 mb-0 max-w-[65ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
                    {t(`${id}Answer`)}
                  </p>
                </details>
              ))}
            </div>
          </StaffPanel>
          <aside className="rounded-3xl bg-(--t-ink-base) p-6 text-white sm:p-7">
            <h2 className="m-0 font-serif text-[26px] leading-tight">
              {t("helpTitle")}
            </h2>
            <p className="mt-3 mb-5 text-[15px] leading-relaxed text-white/80">
              {t("helpCopy")}
            </p>
            <Link
              href="/contribute/discussions"
              className={buttonVariants({ variant: "surface", size: "pill" })}
            >
              {t("askCommunity")}
            </Link>
          </aside>
        </div>
      </Container>
    </>
  )
}
