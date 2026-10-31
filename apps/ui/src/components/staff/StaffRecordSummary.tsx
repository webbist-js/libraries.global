"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import type { StaffLibrarySummary } from "@/lib/access-server"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import { useStaffRecordMetrics } from "@/lib/staff/use-record-metrics"

/** Actor and record keyed; a failed request never becomes a reassuring zero. */
export function StaffRecordSummary({
  userId,
  library,
}: {
  readonly userId: string
  readonly library: StaffLibrarySummary
}) {
  const t = useTranslations("workspaceDashboard"),
    ui = useTranslations("ui")
  const { data, isPending, isError, refetch } = useStaffRecordMetrics(
    userId,
    library.id
  )
  const completeness = data?.completeness

  return (
    <section className="workspace-staff-summary" aria-busy={isPending}>
      <Badge
        label={ui("verified_staff")}
        color="ok"
        icon="mdi:shield-check-outline"
      />
      <h2 className="type-small-heading">{library.name}</h2>
      {isPending ? (
        <span className="sr-only" role="status">
          {t("summaryLoading")}
        </span>
      ) : null}
      {isError ? (
        <p role="status">
          {t("summaryUnavailable")}{" "}
          <button type="button" onClick={() => void refetch()}>
            {t("retry")}
          </button>
        </p>
      ) : (
        <>
          <div className="flex justify-between gap-2 text-sm">
            <span>{t("recordComplete")}</span>
            <strong>{completeness == null ? "—" : `${completeness}%`}</strong>
          </div>
          {completeness != null ? (
            <progress
              max={100}
              value={completeness}
              aria-label={t("recordComplete")}
            />
          ) : null}
          <dl>
            <div>
              <dt>{t("suggestions")}</dt>
              <dd>{data?.suggestions ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("noticesLive")}</dt>
              <dd>{data?.noticesActive ?? "—"}</dd>
            </div>
          </dl>
        </>
      )}
      <Link href={staffLibraryHref(library.slug)}>{t("openStaff")} →</Link>
    </section>
  )
}
