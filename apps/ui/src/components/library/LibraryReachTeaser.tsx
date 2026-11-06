"use client"

import { Icon } from "@iconify/react"
import { CONTRIBUTOR_REACH_PER_WEEK } from "@repo/access"
import type { AtlasReachMode } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { buttonVariants } from "@/components/ui/button"
import { useEntitlements } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const MINUTES = [5, 10, 15, 30] as const

const primaryAction = buttonVariants({
  variant: "primary",
  size: "pill",
  className: "w-full sm:w-auto",
})
const secondaryAction = buttonVariants({
  variant: "surface",
  size: "pill",
  className: "w-full border-(--t-border-hi) sm:w-auto",
})

/**
 * Travel-time Reach on a library page. Contributors and API customers open
 * the real Atlas workflow (calculations start there, on demand); everyone
 * else sees what Reach shows and one clear way to unlock it.
 */
export function LibraryReachTeaser({
  libraryId,
  embedded = false,
}: {
  readonly embedded?: boolean
  readonly libraryId?: string
}) {
  const t = useTranslations("atlasAnalysis")
  const tLock = useTranslations("accessLocks")
  const { can, ready } = useEntitlements()
  const [mode, setMode] = useState<AtlasReachMode>("walking")
  const canReach = ready && can("atlas.reach")
  const params = new URLSearchParams({ layers: "pins,reach", reachMode: mode })
  if (libraryId) params.set("lib", libraryId)

  return (
    <section
      aria-label={embedded ? t("reach") : undefined}
      className="flex flex-col gap-5 rounded-2xl p-5 sm:p-6"
      style={{
        background: T.accent.chip,
        border: `1px solid ${T.border.line}`,
      }}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: T.bg.deep, color: T.accent.primary }}
        >
          <Icon height={24} icon="mdi:map-marker-radius-outline" width={24} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          {!embedded ? <h3 className="type-h3 m-0">{t("reach")}</h3> : null}
          <p className="m-0 text-base leading-relaxed">
            {t("reachExplanation")}
          </p>
        </div>
      </div>

      <ul aria-hidden="true" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {MINUTES.map((count) => (
          <li
            key={count}
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: T.bg.deep, color: T.ink.dim }}
          >
            {t("minutes", { count })}
          </li>
        ))}
      </ul>

      {canReach ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            label={t("travelMode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "walking", label: t("walking") },
              { value: "cycling", label: t("cycling") },
            ]}
          />
          <Link href={`/map?${params}`} className={primaryAction}>
            {t("openReach")}
            <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
          </Link>
        </div>
      ) : (
        <div
          className="flex flex-col gap-4 rounded-xl p-4"
          style={{ background: T.bg.deep }}
        >
          <p className="m-0 flex items-start gap-2 text-base font-semibold">
            <Icon
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              height={20}
              icon="mdi:lock-outline"
              style={{ color: T.accent.primary }}
              width={20}
            />
            <span>
              {tLock("reachLocked", { count: CONTRIBUTOR_REACH_PER_WEEK })}
            </span>
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/contribute" className={primaryAction}>
              {tLock("reachCta")}
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
            </Link>
            <Link href="/developers" className={secondaryAction}>
              {tLock("aboutApiAccess")}
            </Link>
          </div>
          <p
            className="m-0 text-sm leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            {tLock("reachApi")}
          </p>
        </div>
      )}

      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        {t("reachAvailability")}
      </p>
    </section>
  )
}
