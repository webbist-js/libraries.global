"use client"

import { CONTRIBUTOR_REACH_PER_WEEK } from "@repo/access"
import type { AtlasReachMode } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { useEntitlements } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

/** The library page opens the real Atlas workflow; calculations start on demand. */
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
    <div
      className="flex flex-col gap-4 rounded-2xl p-5"
      style={{
        background: T.accent.chip,
        border: `1px solid ${T.border.line}`,
      }}
    >
      {!embedded ? <h3 className="type-h3 m-0">{t("reach")}</h3> : null}
      <p className="m-0 text-base">{t("reachAvailability")}</p>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        {t("travelMode")}
        <SelectField
          label={t("travelMode")}
          value={mode}
          onValueChange={(value) => setMode(value as AtlasReachMode)}
          options={[
            { value: "walking", label: t("walking") },
            { value: "cycling", label: t("cycling") },
          ]}
        />
      </label>
      <p className="m-0 text-base">{t("reachExplanation")}</p>
      {canReach ? (
        <Link
          href={`/map?${params}`}
          className="min-h-11 rounded-full bg-(--t-action-primary) px-4 py-3 text-center text-base font-semibold text-white no-underline"
        >
          {t("openReach")}
        </Link>
      ) : (
        <>
          <p className="m-0 text-base font-semibold">
            {tLock("reachLocked", { count: CONTRIBUTOR_REACH_PER_WEEK })}
          </p>
          <p className="m-0 text-base">{tLock("reachApi")}</p>
          <div className="flex flex-wrap gap-x-5">
            <Link
              href="/contribute"
              className="inline-flex min-h-11 items-center text-base font-semibold underline"
            >
              {tLock("howToContribute")}
            </Link>
            <Link
              href="/developers"
              className="inline-flex min-h-11 items-center text-base font-semibold underline"
            >
              {tLock("aboutApiAccess")}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
