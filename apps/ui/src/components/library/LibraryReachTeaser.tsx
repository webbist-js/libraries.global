"use client"

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
  const { can, ready } = useEntitlements()
  const [mode, setMode] = useState<AtlasReachMode>("walking")
  const isPro = ready && can("atlas.analysis")
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
      {!embedded ? (
        <h3 className="m-0 text-xl font-semibold">{t("reach")}</h3>
      ) : null}
      <p className="m-0 text-sm">{t("reachAvailability")}</p>
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
      <p className="m-0 text-sm">{t("reachExplanation")}</p>
      {isPro ? (
        <Link
          href={`/map?${params}`}
          className="min-h-11 rounded-full bg-(--t-accent-primary) px-4 py-3 text-center text-sm font-semibold text-white no-underline"
        >
          {t("openReach")}
        </Link>
      ) : (
        <>
          <p className="m-0 text-sm">{t("reachAccessMessage")}</p>
          <Link
            href="/contribute/membership"
            className="min-h-11 py-3 text-sm font-semibold underline"
          >
            {t("seePlans")}
          </Link>
        </>
      )}
    </div>
  )
}
