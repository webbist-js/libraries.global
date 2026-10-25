"use client"

import {
  ATLAS_REACH_MAX_VISIBLE_LIBRARIES,
  ATLAS_REACH_MAX_SERVICE_LIBRARIES,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { Icon } from "./atlas-ui"

export function AtlasReachLimitNotice({
  reason,
  onZoom,
  onSingleLibrary,
}: {
  readonly reason: "zoom" | "busy" | "libraries" | "area"
  readonly onZoom?: () => void
  readonly onSingleLibrary?: () => void
}) {
  const t = useTranslations("atlasReachLimits")
  const serviceLimit = reason === "libraries" || reason === "area"

  return (
    <section
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-sm leading-relaxed"
    >
      <Icon
        name={serviceLimit ? "info" : "search"}
        size={18}
        className="mt-0.5 text-(--t-accent-primary)"
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">
          {t(serviceLimit ? "serviceTitle" : "zoomTitle")}
        </p>
        <p className="mt-1 mb-0 text-xs text-(--t-ink-dim)">
          {t(reason, {
            count:
              reason === "libraries"
                ? ATLAS_REACH_MAX_SERVICE_LIBRARIES
                : ATLAS_REACH_MAX_VISIBLE_LIBRARIES,
          })}
        </p>
        {(serviceLimit ? onSingleLibrary : onZoom) ? (
          <button
            type="button"
            onClick={serviceLimit ? onSingleLibrary : onZoom}
            className="mt-2 min-h-10 text-xs font-semibold text-(--t-accent-primary) underline underline-offset-2"
          >
            {t(serviceLimit ? "singleLibrary" : "zoomIn")}
          </button>
        ) : null}
      </div>
    </section>
  )
}
