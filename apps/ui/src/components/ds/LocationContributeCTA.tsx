"use client"

import { authClient } from "@/lib/auth-client"
import { Link } from "@/lib/navigation"

export interface LocationContributeCTAProps {
  locationName?: string
  entityType?: "continent" | "country" | "region" | "area" | "library"
  /** Pass the library slug so the primary CTA can deep-link to the edit wizard / correction form. */
  librarySlug?: string
}

export function LocationContributeCTA({
  locationName = "this area",
  entityType,
  librarySlug,
}: LocationContributeCTAProps) {
  const { data: session } = authClient.useSession()
  const isSignedIn = !!session?.user
  const isLibrary = entityType === "library"

  const heading = isLibrary
    ? `Know something we don't?`
    : `Help keep ${locationName}'s index current.`

  const body = isLibrary
    ? `Spotted an error, a missing opening time, or a new service? Help us keep the ${locationName} page accurate and up to date.`
    : `We track every institution holding more than 1,000 volumes. Missing a village library? A closed archive? Help us keep things moving to an organized record.`

  const primaryLabel = isLibrary
    ? "Suggest a correction"
    : "Propose an addition"
  const secondaryLabel = isLibrary
    ? "Edit this library →"
    : "Submit a correction →"

  const correctionPath = librarySlug
    ? `/contribute/correct/${librarySlug}?libraryName=${encodeURIComponent(locationName ?? "")}`
    : "/contribute"

  // Resolve primary href based on auth state and entity context
  const primaryHref = isSignedIn
    ? isLibrary
      ? correctionPath
      : `/contribute/add`
    : `/auth/signin?callbackUrl=${encodeURIComponent(isLibrary ? correctionPath : `/contribute/add`)}`

  const secondaryHref = isLibrary
    ? isSignedIn
      ? librarySlug
        ? `/contribute/edit/${librarySlug}`
        : `/contribute/edit`
      : `/auth/signin?callbackUrl=${encodeURIComponent(librarySlug ? `/contribute/edit/${librarySlug}` : `/contribute/edit`)}`
    : "/knowledge/contributing/how-to-contribute"

  return (
    <section className="py-14 sm:py-18">
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-8 py-10 shadow-[0_32px_80px_rgba(0,0,0,0.15)] sm:px-12 sm:py-12">
          {/* Dark-mode: teal left + violet right */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_120%_at_-8%_50%,rgba(67,56,202,0.08),transparent_58%),radial-gradient(ellipse_65%_90%_at_108%_50%,rgba(163,148,255,0.13),transparent_55%)]" />
          {/* Light-mode: sage left + amber right sweep */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(90,150,90,0.09)_0%,transparent_38%,rgba(210,170,70,0.10)_100%)]" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[48ch]">
              <h2 className="mb-3 font-serif text-3xl font-normal tracking-tight text-(--t-ink-base) sm:text-4xl">
                {heading}
              </h2>
              <p className="text-[15px] leading-relaxed text-(--t-ink-dim)">
                {body}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-(--t-ink-base) px-6 py-2.5 text-sm font-semibold text-(--t-bg-void) shadow-[0_4px_24px_rgba(0,0,0,0.14)] transition-all hover:opacity-90"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-surface) px-6 py-2.5 text-sm font-medium text-(--t-ink-dim) transition-all hover:bg-(--t-bg-deep) hover:text-(--t-ink-base)"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
